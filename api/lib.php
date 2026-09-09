<?php
/**
 * Shared storage for the visitor counter and the stats panel.
 *
 * Everything lives in flat JSON files, one per day, holding one row per
 * visitor. There is no database to install and nothing to configure: a day
 * with 500 visitors is a 60 KB file, and the panel never reads more than the
 * retention window. Files older than RETAIN_DAYS are deleted on write, so the
 * data cannot pile up unattended.
 *
 * Nothing the browser sends is ever used to build a path. The only request
 * values that get stored are the caller's IP and its User-Agent, and the
 * User-Agent is length-capped before it goes anywhere near the disk.
 */
declare(strict_types=1);

// config.php holds the real password and is deliberately not in the
// repository. Falling back to the template keeps a fresh clone runnable; the
// panel checks for the placeholder and refuses to open on it.
require_once is_file(__DIR__ . '/config.php')
    ? __DIR__ . '/config.php'
    : __DIR__ . '/config.example.php';

const LIVE_WINDOW  = 180;    // seconds a visitor still counts as "here"
const SESSION_GAP  = 1800;   // a gap longer than this starts a new visit
const COUNT_GAP    = 120;    // a gap longer than this is not counted as time on site
const RETAIN_DAYS  = 30;     // how long any of this is kept at all
const MAX_ROWS     = 20000;  // hard ceiling on rows in one day, as a stop
const MAX_UA       = 200;    // characters of User-Agent kept

/** The directory the day files live in, or null if we cannot write anywhere. */
function store_dir(): ?string {
    static $dir = false;
    if ($dir !== false) return $dir;

    $candidates = [__DIR__ . '/data', sys_get_temp_dir() . '/clouterx-stats'];
    foreach ($candidates as $c) {
        if (!is_dir($c)) @mkdir($c, 0700, true);
        if (is_dir($c) && is_writable($c)) {
            // Belt and braces: the day files must never be readable over HTTP,
            // even if this ends up somewhere the web server serves.
            $guard = $c . '/.htaccess';
            if (!file_exists($guard)) {
                @file_put_contents($guard, "Require all denied\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n");
            }
            return $dir = $c;
        }
    }
    return $dir = null;
}

/** A per-install random value, so visitor keys cannot be recomputed off-site. */
function salt(): string {
    $dir = store_dir();
    if ($dir === null) return 'clouterx';
    $file = $dir . '/salt';
    $s = @file_get_contents($file);
    if (is_string($s) && strlen($s) >= 16) return $s;
    $s = bin2hex(random_bytes(16));
    @file_put_contents($file, $s, LOCK_EX);
    return $s;
}

/**
 * The caller's IP.
 *
 * X-Forwarded-For is only believed when the direct peer is a private address,
 * which is the one case where it must be a proxy in front of us. Trusting it
 * unconditionally would let anyone pick their own IP and inflate the counts.
 */
function client_ip(): string {
    $peer = $_SERVER['REMOTE_ADDR'] ?? '';
    $private = !filter_var($peer, FILTER_VALIDATE_IP,
        FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
    if ($private && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        foreach (explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']) as $part) {
            $ip = trim($part);
            if (filter_var($ip, FILTER_VALIDATE_IP,
                FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) return $ip;
        }
    }
    return filter_var($peer, FILTER_VALIDATE_IP) ? $peer : '0.0.0.0';
}

/**
 * The IP as it gets written to disk.
 *
 * With STORE_FULL_IP off, the last group is dropped before storage, so the
 * exact address is never written down at all. The visitor key is still built
 * from the full address, so masking does not merge separate people in the
 * same street into one row.
 */
function stored_ip(string $ip): string {
    if (STORE_FULL_IP) return $ip;
    if (str_contains($ip, ':')) {                    // IPv6: keep the routing prefix
        $p = explode(':', $ip);
        return implode(':', array_slice($p, 0, 3)) . ':x';
    }
    $p = explode('.', $ip);
    return count($p) === 4 ? $p[0] . '.' . $p[1] . '.' . $p[2] . '.x' : $ip;
}

function day_file(string $day): string {
    // $day is always built here from a timestamp, never from the request.
    return store_dir() . '/v-' . $day . '.json';
}

function read_day(string $day): array {
    $dir = store_dir();
    if ($dir === null) return [];
    $raw = @file_get_contents(day_file($day));
    if (!is_string($raw) || $raw === '') return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/** Delete anything past the retention window. Cheap, and rarely run. */
function purge(): void {
    $dir = store_dir();
    if ($dir === null) return;
    $cutoff = time() - RETAIN_DAYS * 86400;
    foreach (glob($dir . '/v-*.json') ?: [] as $f) {
        if (preg_match('/v-(\d{4})-(\d{2})-(\d{2})\.json$/', $f, $m)) {
            $t = mktime(0, 0, 0, (int)$m[2], (int)$m[3], (int)$m[1]);
            if ($t !== false && $t < $cutoff) @unlink($f);
        }
    }
}

/**
 * Record one heartbeat and return how many visitors are live right now.
 *
 * The whole day file is read, updated and written back under an exclusive
 * lock. At this scale that is a few kilobytes and no contention worth
 * engineering around.
 */
function beat(): int {
    $dir = store_dir();
    $now = time();
    if ($dir === null) return -1;

    $day  = gmdate('Y-m-d', $now);
    $ip   = client_ip();
    $ua   = substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, MAX_UA);
    $key  = substr(hash('sha256', $ip . '|' . $ua . '|' . salt()), 0, 12);

    $file = day_file($day);
    $fh = @fopen($file, 'c+');
    if ($fh === false) return -1;
    if (!flock($fh, LOCK_EX)) { fclose($fh); return -1; }

    $raw  = stream_get_contents($fh);
    $rows = is_string($raw) && $raw !== '' ? json_decode($raw, true) : [];
    if (!is_array($rows)) $rows = [];

    if (isset($rows[$key]) && is_array($rows[$key])) {
        $r   = $rows[$key];
        $gap = $now - (int)($r['last'] ?? $now);
        if ($gap > 0 && $gap <= COUNT_GAP) $r['secs'] = (int)($r['secs'] ?? 0) + $gap;
        if ($gap > SESSION_GAP)            $r['visits'] = (int)($r['visits'] ?? 1) + 1;
        $r['last'] = $now;
        $r['hits'] = (int)($r['hits'] ?? 0) + 1;
        $r['ip']   = stored_ip($ip);
        $rows[$key] = $r;
    } elseif (count($rows) < MAX_ROWS) {
        $rows[$key] = ['ip' => stored_ip($ip), 'ua' => $ua, 'first' => $now,
                       'last' => $now, 'secs' => 0, 'hits' => 1, 'visits' => 1];
    }

    $out = json_encode($rows);
    if ($out !== false) {
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, $out);
        fflush($fh);
    }
    flock($fh, LOCK_UN);
    fclose($fh);

    if (random_int(1, 50) === 1) purge();

    return live_count($now, $rows, $day);
}

/**
 * Visitors seen inside the live window.
 *
 * Yesterday is included as well, because a few minutes after midnight UTC the
 * people who are still playing are recorded in the previous day's file.
 */
function live_count(int $now, ?array $today = null, ?string $day = null): int {
    $day  ??= gmdate('Y-m-d', $now);
    $rows   = $today ?? read_day($day);
    $cutoff = $now - LIVE_WINDOW;
    $seen   = 0;
    foreach ($rows as $r) if ((int)($r['last'] ?? 0) >= $cutoff) $seen++;
    if ($now - strtotime($day . ' 00:00:00 UTC') < LIVE_WINDOW * 2) {
        foreach (read_day(gmdate('Y-m-d', $now - 86400)) as $k => $r) {
            if ((int)($r['last'] ?? 0) >= $cutoff && !isset($rows[$k])) $seen++;
        }
    }
    return $seen;
}

/**
 * Everything the panel shows, gathered in one pass over the retained days.
 *
 * Visitors are merged across days by their key, so someone who came back on
 * three days is one row with three days' time added up — which is the whole
 * point of the "returning" column.
 */
function aggregate(int $days): array {
    $now    = time();
    $byDay  = [];
    $people = [];

    for ($i = $days - 1; $i >= 0; $i--) {
        $day  = gmdate('Y-m-d', $now - $i * 86400);
        $rows = read_day($day);
        $byDay[$day] = count($rows);
        foreach ($rows as $key => $r) {
            $p = $people[$key] ?? ['ip' => '', 'ua' => '', 'first' => PHP_INT_MAX,
                                   'last' => 0, 'secs' => 0, 'visits' => 0,
                                   'hits' => 0, 'days' => 0];
            $p['ip']     = (string)($r['ip'] ?? $p['ip']);
            $p['ua']     = (string)($r['ua'] ?? $p['ua']);
            $p['first']  = min($p['first'], (int)($r['first'] ?? $now));
            $p['last']   = max($p['last'],  (int)($r['last']  ?? 0));
            $p['secs']  += (int)($r['secs']   ?? 0);
            $p['visits']+= (int)($r['visits'] ?? 0);
            $p['hits']  += (int)($r['hits']   ?? 0);
            $p['days']  += 1;
            $people[$key] = $p;
        }
    }

    uasort($people, fn($a, $b) => $b['last'] <=> $a['last']);

    $times = [];
    foreach ($people as $p) if ($p['secs'] > 0) $times[] = $p['secs'];
    sort($times);
    $median = $times ? (int)$times[intdiv(count($times), 2)] : 0;

    $today = gmdate('Y-m-d', $now);
    return [
        'byDay'    => $byDay,
        'people'   => $people,
        'live'     => live_count($now),
        'today'    => $byDay[$today] ?? 0,
        'unique'   => count($people),
        'visits'   => array_sum(array_column($people, 'visits')),
        'median'   => $median,
        'returning'=> count(array_filter($people, fn($p) => $p['days'] > 1)),
        'totalSecs'=> array_sum(array_column($people, 'secs')),
    ];
}
