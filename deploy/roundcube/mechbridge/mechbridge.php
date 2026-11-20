<?php
/**
 * Mechbridge plugin for Roundcube webmail (mail.mechbridgegroup.com).
 *
 * - Applies the webmail settings chosen in the staff portal (Mailboxes > Webmail settings for everyone)
 *   as defaults, or for everyone when they are locked.
 * - Sets each mailbox's sender name and the company signature from the portal.
 * - Brands the sign-in screen.
 *
 * Reads two files written by the staff portal through /usr/local/sbin/mb-mailbox:
 *   /var/lib/mailboxes/webmail.json   settings (JSON)
 *   /var/lib/mailboxes/names          address<TAB>sender name, one per line
 * Install: see GO-LIVE.md, step 8.1.
 */
class mechbridge extends rcube_plugin
{
    public $task = '.*';

    const DIR = '/var/lib/mailboxes';
    const SITE = 'https://mechbridgegroup.com';
    const MARK = '<!-- mechbridge-signature -->';

    private $settings;

    private static $defaults = array(
        'language' => 'en_GB', 'timezone' => 'Asia/Dubai', 'compose_html' => true, 'show_images' => 1,
        'reply_above' => true, 'autosave_minutes' => 2, 'page_size' => 50, 'layout' => 'widescreen', 'lock' => false,
        'signature' => 'empty', 'signature_title' => 'Mechbridge International MEP Consultants', 'signature_phone' => '',
        'signature_web' => 'mechbridgegroup.com',
        'login_note' => 'Staff email for Mechbridge International. Sign in with your full email address.',
    );

    public function init()
    {
        $rc = rcmail::get_instance();
        $s = $this->settings = $this->load_settings();

        $rc->config->set('product_name', 'Mechbridge Mail');
        $rc->config->set('display_product_info', 0);

        // Portal settings → Roundcube options.
        $options = array(
            'language' => $s['language'],
            'timezone' => $s['timezone'],
            'htmleditor' => $s['compose_html'] ? 1 : 0,
            'show_images' => (int) $s['show_images'],
            'reply_mode' => $s['reply_above'] ? 1 : 0,
            'draft_autosave' => max(0, (int) $s['autosave_minutes']) * 60,
            'mail_pagesize' => max(10, (int) $s['page_size']),
            'layout' => $s['layout'],
        );
        // Unlocked: only fill in what the person hasn't chosen themselves. Locked: always apply, and hide the option.
        $prefs = array();
        if (!empty($rc->user) && !empty($rc->user->ID)) {
            $prefs = (array) $rc->user->get_prefs();
        }
        foreach ($options as $key => $value) {
            if (!empty($s['lock']) || !array_key_exists($key, $prefs)) {
                $rc->config->set($key, $value);
            }
        }
        if (!empty($s['lock'])) {
            $keep = (array) $rc->config->get('dont_override', array());
            $rc->config->set('dont_override', array_values(array_unique(array_merge($keep, array_keys($options)))));
        }

        $this->add_hook('user_create', array($this, 'user_create'));
        $this->add_hook('login_after', array($this, 'login_after'));
        $this->add_hook('template_object_loginform', array($this, 'login_form'));

        if ($rc->task == 'login' || $rc->task == 'logout' || empty($_SESSION['user_id'])) {
            $this->include_stylesheet('login.css');
        }
    }

    /** First sign-in: the identity starts with the sender name from the portal. */
    public function user_create($args)
    {
        $name = $this->name_for($args['user']);
        if ($name !== '') {
            $args['user_name'] = $name;
        }
        return $args;
    }

    /** Every sign-in: keep the sender name and the company signature in step with the portal. */
    public function login_after($args)
    {
        $rc = rcmail::get_instance();
        if (empty($rc->user) || empty($rc->user->ID)) {
            return $args;
        }
        $ident = $rc->user->get_identity();
        if (empty($ident)) {
            return $args;
        }
        $update = array();
        $name = $this->name_for($rc->user->get_username());
        if ($name !== '' && $ident['name'] !== $name) {
            $update['name'] = $name;
        }
        $mode = $this->settings['signature'];
        if ($mode !== 'off') {
            $current = (string) $ident['signature'];
            $ours = strpos($current, self::MARK) !== false;
            $empty = trim(strip_tags($current)) === '';
            if ($mode === 'always' || $empty || $ours) {
                $sig = $this->signature($name !== '' ? $name : $ident['name'], $ident['email']);
                if ($current !== $sig) {
                    $update['signature'] = $sig;
                    $update['html_signature'] = 1;
                }
            }
        }
        if ($update) {
            $rc->user->update_identity($ident['identity_id'], $update);
        }
        return $args;
    }

    /** Sign-in screen: a heading above the form and the portal's note below it. */
    public function login_form($args)
    {
        $head = html::div(array('class' => 'mb-login-head'),
            html::tag('h2', null, 'Mechbridge Mail') . html::p(null, 'Sign in to your company email'));
        $note = trim((string) $this->settings['login_note']);
        $args['content'] = $head . $args['content'] . ($note !== '' ? html::p(array('class' => 'mb-login-note'), rcube::Q($note)) : '');
        return $args;
    }

    private function load_settings()
    {
        $file = self::DIR . '/webmail.json';
        $data = is_readable($file) ? json_decode((string) @file_get_contents($file), true) : null;
        return array_merge(self::$defaults, is_array($data) ? array_intersect_key($data, self::$defaults) : array());
    }

    private function name_for($address)
    {
        $file = self::DIR . '/names';
        if (!is_readable($file)) {
            return '';
        }
        $address = strtolower(trim((string) $address));
        foreach ((array) @file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $parts = explode("\t", $line, 2);
            if (count($parts) == 2 && strtolower($parts[0]) === $address) {
                return trim($parts[1]);
            }
        }
        return '';
    }

    /** Same design as signatureHtml() in src/lib/mail-html.ts. */
    private function signature($name, $email)
    {
        $s = $this->settings;
        $q = function ($v) { return htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8'); };
        $web = preg_replace('#^https?://#', '', trim((string) $s['signature_web']));
        $bits = array();
        if (trim((string) $s['signature_phone']) !== '') {
            $bits[] = '<a href="tel:' . $q(preg_replace('/[^\d+]/', '', $s['signature_phone'])) . '" style="color:#1A2841;text-decoration:none;">' . $q($s['signature_phone']) . '</a>';
        }
        if ($email) {
            $bits[] = '<a href="mailto:' . $q($email) . '" style="color:#B11722;text-decoration:none;">' . $q($email) . '</a>';
        }
        if ($web !== '') {
            $bits[] = '<a href="https://' . $q($web) . '" style="color:#B11722;text-decoration:none;">' . $q($web) . '</a>';
        }
        $sep = '<span style="color:#E4CDB0;">&nbsp;&nbsp;|&nbsp;&nbsp;</span>';
        $font = 'Arial,Helvetica,sans-serif';
        return self::MARK
            . '<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:6px;border-collapse:collapse;"><tr>'
            . '<td style="padding:2px 16px 2px 0;border-right:2px solid #B11722;vertical-align:middle;"><img src="' . self::SITE . '/logo/mechbridge-email-navy.png" width="78" height="48" alt="Mechbridge International" style="display:block;border:0;"></td>'
            . '<td style="padding:2px 0 2px 16px;vertical-align:middle;font:13px/1.5 ' . $font . ';color:#5B6A86;">'
            . ($name !== '' ? '<div style="font:700 15px/1.3 ' . $font . ';color:#1A2841;">' . $q($name) . '</div>' : '')
            . (trim((string) $s['signature_title']) !== '' ? '<div style="color:#1A2841;">' . $q($s['signature_title']) . '</div>' : '')
            . ($bits ? '<div style="margin-top:4px;">' . implode($sep, $bits) . '</div>' : '')
            . '</td></tr></table>';
    }
}
