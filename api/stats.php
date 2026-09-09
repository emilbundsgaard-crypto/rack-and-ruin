<?php
/**
 * The stats panel. One page, one password, no dependencies.
 *
 * Every value that reaches the page goes through h() on the way out, including
 * the User-Agent, which is the only field a visitor controls.
 */
declare(strict_types=1);
require __DIR__ . '/lib.php';

session_start();
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');

function h(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }

if (isset($_GET['logout'])) { session_destroy(); header('Location: stats.php'); return; }

// A site running on the shipped template would be a panel of visitor data with
// a published password on it. Refuse, and say what to do about it.
if (STATS_PASSWORD === 'change-me') {
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    echo "The stats panel is not configured.\n\n"
       . "Copy api/config.example.php to api/config.php and set STATS_PASSWORD\n"
       . "to something only you know. The panel will not open until you do.\n";
    return;
}

$bad = false;
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    // hash_equals keeps the comparison from leaking the password one character
    // at a time through how long it takes to fail.
    if (hash_equals(STATS_PASSWORD, (string)($_POST['pw'] ?? ''))) {
        session_regenerate_id(true);
        $_SESSION['ok'] = true;
    } else {
        $bad = true;
        usleep(400000);           // makes guessing at scale tedious
    }
}

$authed = !empty($_SESSION['ok']);

/** Seconds as something a human reads at a glance. */
function dur(int $s): string {
    if ($s <= 0)   return '—';
    if ($s < 60)   return $s . 's';
    if ($s < 3600) return intdiv($s, 60) . 'm ' . ($s % 60) . 's';
    return intdiv($s, 3600) . 't ' . intdiv($s % 3600, 60) . 'm';
}

function ago(int $t): string {
    $d = time() - $t;
    if ($d < 60)    return 'nu';
    if ($d < 3600)  return intdiv($d, 60) . ' min siden';
    if ($d < 86400) return intdiv($d, 3600) . ' timer siden';
    return intdiv($d, 86400) . ' dage siden';
}

/** Which browser, roughly. The full string is kept in the title attribute. */
function browser(string $ua): string {
    foreach ([['Edg', 'Edge'], ['OPR', 'Opera'], ['Chrome', 'Chrome'],
              ['Firefox', 'Firefox'], ['Safari', 'Safari'], ['bot', 'Bot'],
              ['Bot', 'Bot'], ['curl', 'curl']] as [$needle, $name]) {
        if (str_contains($ua, $needle)) return $name;
    }
    return $ua === '' ? '—' : 'Andet';
}

function device(string $ua): string {
    if (preg_match('/iPhone|iPod/', $ua))          return 'iPhone';
    if (preg_match('/iPad/', $ua))                 return 'iPad';
    if (preg_match('/Android/', $ua))              return 'Android';
    if (preg_match('/Macintosh|Mac OS X/', $ua))   return 'Mac';
    if (preg_match('/Windows/', $ua))              return 'Windows';
    if (preg_match('/Linux/', $ua))                return 'Linux';
    return '—';
}

$data = $authed ? aggregate(RETAIN_DAYS) : null;
?>
<!doctype html>
<html lang="da">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>ClouterX — statistik</title>
<style>
  :root {
    --bg:#0e0c0a; --panel:#15120f; --panel2:#1b1713; --line:#292319; --line2:#3b3225;
    --fg:#ede6da; --dim:#a2978a; --dimmer:#6e6458; --acc:#f2a83c; --good:#93cc6d;
    --bad:#e5614f; --cold:#6fc8d8;
    --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    --sans: system-ui, -apple-system, "Segoe UI", Inter, Roboto, sans-serif;
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font:14px/1.5 var(--sans);
         padding:22px; }
  .wrap { max-width:1080px; margin:0 auto; }
  header { display:flex; align-items:baseline; gap:12px; flex-wrap:wrap;
           border-bottom:1px solid var(--line); padding-bottom:14px; margin-bottom:22px; }
  h1 { font-size:20px; margin:0; letter-spacing:.2px; }
  h1 span { color:var(--acc); }
  .muted { color:var(--dim); font-size:12px; }
  a { color:var(--acc); }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr));
           gap:10px; margin-bottom:22px; }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:6px;
          padding:12px 14px; display:flex; flex-direction:column; }
  .card .k { font-size:11px; text-transform:uppercase; letter-spacing:.7px;
             color:var(--dimmer); }
  /* margin-top:auto sits every number on the floor of its card, so a label that
   wraps to two lines cannot knock one figure out of line with the rest. */
  .card .v { font:600 24px/1.2 var(--mono); margin-top:auto; padding-top:6px; }
  .card.live .v { color:var(--good); }
  .card.live .v.zero { color:var(--dimmer); }
  section { background:var(--panel); border:1px solid var(--line); border-radius:6px;
            padding:16px; margin-bottom:22px; }
  h2 { font-size:13px; text-transform:uppercase; letter-spacing:.8px; color:var(--dim);
       margin:0 0 14px; font-weight:600; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th { text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.6px;
       color:var(--dimmer); font-weight:600; padding:0 10px 8px 0;
       border-bottom:1px solid var(--line); }
  td { padding:8px 10px 8px 0; border-bottom:1px solid #1e1a15; vertical-align:top; }
  tr:last-child td { border-bottom:0; }
  td.ip { font-family:var(--mono); }
  td.num { font-family:var(--mono); text-align:right; padding-right:18px; }
  .dot { display:inline-block; width:7px; height:7px; border-radius:50%;
         background:var(--good); margin-right:7px; vertical-align:middle; }
  .scroll { overflow-x:auto; }
  form.login { max-width:320px; margin:14vh auto 0; background:var(--panel);
               border:1px solid var(--line); border-radius:6px; padding:22px; }
  input { width:100%; padding:10px 12px; background:var(--bg); color:var(--fg);
          border:1px solid var(--line2); border-radius:5px; font:14px var(--sans);
          margin:10px 0 12px; }
  button { width:100%; padding:10px; background:var(--acc); color:#241a08; border:0;
           border-radius:5px; font:600 14px var(--sans); cursor:pointer; }
  .err { color:var(--bad); font-size:12px; margin:0 0 6px; }
  .empty { color:var(--dimmer); padding:20px 0; text-align:center; }
</style>
</head>
<body>
<div class="wrap">

<?php if (!$authed): ?>
  <form class="login" method="post">
    <h1>Clouter<span>X</span></h1>
    <p class="muted" style="margin:6px 0 0">Statistik</p>
    <?php if ($bad): ?><p class="err" style="margin-top:14px">Forkert kodeord.</p><?php endif; ?>
    <input type="password" name="pw" placeholder="Kodeord" autofocus autocomplete="current-password">
    <button type="submit">Log ind</button>
  </form>

<?php else: ?>
  <header>
    <h1>Clouter<span>X</span></h1>
    <span class="muted">Sidste <?= RETAIN_DAYS ?> dage · opdateret <?= gmdate('H:i') ?> UTC</span>
    <span style="margin-left:auto"><a href="?logout=1">Log ud</a></span>
  </header>

  <div class="cards">
    <div class="card live">
      <div class="k">Spiller lige nu</div>
      <div class="v <?= $data['live'] ? '' : 'zero' ?>">
        <?php if ($data['live']): ?><span class="dot"></span><?php endif; ?><?= $data['live'] ?>
      </div>
    </div>
    <div class="card"><div class="k">I dag</div><div class="v"><?= $data['today'] ?></div></div>
    <div class="card"><div class="k">Unikke besøgende</div><div class="v"><?= $data['unique'] ?></div></div>
    <div class="card"><div class="k">Gengangere</div><div class="v"><?= $data['returning'] ?></div></div>
    <div class="card"><div class="k">Besøg i alt</div><div class="v"><?= $data['visits'] ?></div></div>
    <div class="card"><div class="k">Typisk på siden</div><div class="v"><?= dur($data['median']) ?></div></div>
    <div class="card"><div class="k">Spilletid i alt</div><div class="v"><?= dur($data['totalSecs']) ?></div></div>
  </div>

  <section>
    <h2>Besøgende pr. dag</h2>
    <?php
      $days = $data['byDay'];
      $max  = max(1, max($days ?: [1]));
      $w    = 26; $gap = 4; $hMax = 130;
      $n    = count($days);
      $vw   = $n * ($w + $gap);
    ?>
    <div class="scroll">
      <svg viewBox="0 0 <?= $vw ?> <?= $hMax + 34 ?>" width="<?= $vw ?>" height="<?= $hMax + 34 ?>"
           role="img" aria-label="Besøgende pr. dag">
        <?php $i = 0; foreach ($days as $day => $c):
          $bh = $c > 0 ? max(3, (int)round($c / $max * $hMax)) : 0;
          $x  = $i * ($w + $gap);
          $y  = $hMax - $bh;
          $isToday = $day === gmdate('Y-m-d');
        ?>
          <rect x="<?= $x ?>" y="<?= $y ?>" width="<?= $w ?>" height="<?= $bh ?>" rx="2"
                fill="<?= $isToday ? '#f2a83c' : '#7a5620' ?>"></rect>
          <?php if ($c > 0): ?>
            <text x="<?= $x + $w / 2 ?>" y="<?= $y - 5 ?>" text-anchor="middle"
                  font-size="10" font-family="ui-monospace, monospace" fill="#a2978a"><?= $c ?></text>
          <?php endif; ?>
          <?php if ($i % 5 === 0 || $isToday): ?>
            <text x="<?= $x + $w / 2 ?>" y="<?= $hMax + 16 ?>" text-anchor="middle"
                  font-size="10" font-family="ui-monospace, monospace"
                  fill="<?= $isToday ? '#f2a83c' : '#6e6458' ?>"><?= substr($day, 8, 2) . '/' . substr($day, 5, 2) ?></text>
          <?php endif; ?>
        <?php $i++; endforeach; ?>
      </svg>
    </div>
  </section>

  <section>
    <h2>Besøgende</h2>
    <?php if (!$data['people']): ?>
      <p class="empty">Ingen besøgende registreret endnu.</p>
    <?php else: ?>
    <div class="scroll">
    <table>
      <thead><tr>
        <th>IP</th><th>Enhed</th><th>Browser</th>
        <th style="text-align:right">Besøg</th>
        <th style="text-align:right">Dage</th>
        <th style="text-align:right">Tid på siden</th>
        <th>Sidst set</th>
      </tr></thead>
      <tbody>
      <?php $live = time() - LIVE_WINDOW; foreach ($data['people'] as $p): ?>
        <tr>
          <td class="ip"><?php if ($p['last'] >= $live): ?><span class="dot"></span><?php endif; ?><?= h($p['ip']) ?></td>
          <td><?= h(device($p['ua'])) ?></td>
          <td title="<?= h($p['ua']) ?>"><?= h(browser($p['ua'])) ?></td>
          <td class="num"><?= $p['visits'] ?></td>
          <td class="num"><?= $p['days'] ?></td>
          <td class="num"><?= dur($p['secs']) ?></td>
          <td class="muted"><?= h(ago($p['last'])) ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
    </div>
    <?php endif; ?>
  </section>

  <p class="muted">
    Alt slettes automatisk efter <?= RETAIN_DAYS ?> dage.
    <?= STORE_FULL_IP ? 'Fulde IP-adresser gemmes.' : 'IP-adresser gemmes forkortet.' ?>
  </p>
<?php endif; ?>

</div>
</body>
</html>
