<?php
/**
 * The endpoint the game calls every so often while someone is playing.
 *
 * It answers with one number and nothing else: how many people are on the site
 * right now. It takes no parameters, so there is nothing to tamper with.
 */
declare(strict_types=1);
require __DIR__ . '/lib.php';

header('Content-Type: application/json');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$live = beat();

// -1 means nothing could be written, so the number would be a lie. Say so, and
// the game hides the counter rather than showing a made-up figure.
if ($live < 0) {
    http_response_code(503);
    echo json_encode(['error' => 'no storage']);
    return;
}

echo json_encode(['live' => $live]);
