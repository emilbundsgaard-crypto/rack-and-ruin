<?php
/**
 * The two settings for the stats panel. Edit this file, nothing else.
 */
declare(strict_types=1);

/**
 * The password for the stats panel.
 *
 * This is the template that ships in the repository, so it deliberately holds
 * no real password: copy it to config.php and put yours there. The panel
 * refuses to open while it still says change-me.
 */
const STATS_PASSWORD = 'change-me';

/**
 * Whether to keep visitors' full IP addresses.
 *
 * true  — the panel lists 203.0.113.5. This is personal data under GDPR: it
 *         needs a line in a privacy policy, and it is deleted after 30 days.
 * false — the last part is dropped before anything is written, so the panel
 *         lists 203.0.113.x. Everything else in the panel works exactly the
 *         same: visitors, return visits, time on site, the graph. You only lose the
 *         ability to read one visitor's exact address.
 *
 * Change it whenever you like; it takes effect on the next visitor.
 */
const STORE_FULL_IP = true;
