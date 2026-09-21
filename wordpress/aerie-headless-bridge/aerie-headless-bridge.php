<?php
/**
 * Plugin Name:       Aerie Headless Bridge
 * Description:       Exposes the content the direct-booking front end needs, and pings it to rebuild when an editor publishes.
 * Version:           1.0.0
 * Requires at least: 6.4
 * Requires PHP:      8.0
 * License:           MIT
 *
 * Install by copying this folder to wp-content/plugins/ and activating it.
 *
 * What it does, and why each part exists:
 *
 *  1. Registers a `property` post type whose only job is to carry editorial
 *     copy for a home that already exists in OwnerRez. OwnerRez stays the
 *     source of truth for rates, calendars and capacity; WordPress owns the
 *     words. The link between them is one field: the OwnerRez property id.
 *
 *  2. Exposes that field — and the other per-property fields — through the REST
 *     API, because a headless front end can only read what `show_in_rest` allows.
 *
 *  3. Calls the front end's revalidation endpoint on publish, so an editor's
 *     change is live in seconds rather than whenever the cache happens to
 *     expire. Without this the CMS feels broken to the people using it most.
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

const AERIE_TEXT_DOMAIN = 'aerie-headless-bridge';

/**
 * Fields the front end reads. Keeping the list in one place means adding a
 * field is a single edit rather than four scattered ones.
 *
 * @return array<string, array{type: string, label: string, single_line: bool}>
 */
function aerie_property_fields(): array
{
    return [
        'ownerrez_property_id' => [
            'type'        => 'string',
            'label'       => 'OwnerRez property ID',
            'single_line' => true,
        ],
        'headline' => [
            'type'        => 'string',
            'label'       => 'Headline (overrides the OwnerRez listing headline)',
            'single_line' => true,
        ],
        'highlights' => [
            'type'        => 'string',
            'label'       => 'Highlights (one per line, up to six)',
            'single_line' => false,
        ],
        'neighbourhood' => [
            'type'        => 'string',
            'label'       => 'The area (HTML allowed)',
            'single_line' => false,
        ],
        'seo_title' => [
            'type'        => 'string',
            'label'       => 'SEO title',
            'single_line' => true,
        ],
        'seo_description' => [
            'type'        => 'string',
            'label'       => 'SEO description',
            'single_line' => true,
        ],
    ];
}

/**
 * The `property` post type.
 *
 * `show_in_rest` is what makes it readable headlessly; without it the front end
 * gets a 404 from /wp-json/wp/v2/property no matter what is published.
 */
function aerie_register_property_post_type(): void
{
    register_post_type('property', [
        'labels' => [
            'name'          => __('Properties', AERIE_TEXT_DOMAIN),
            'singular_name' => __('Property', AERIE_TEXT_DOMAIN),
            'add_new_item'  => __('Add property copy', AERIE_TEXT_DOMAIN),
            'edit_item'     => __('Edit property copy', AERIE_TEXT_DOMAIN),
        ],
        'public'       => false,
        'show_ui'      => true,
        'show_in_rest' => true,
        'rest_base'    => 'property',
        'menu_icon'    => 'dashicons-admin-home',
        'menu_position' => 21,
        'supports'     => ['title', 'editor', 'excerpt', 'thumbnail', 'revisions'],
        'has_archive'  => false,
        // Not publicly queryable on the WordPress side: the only front end is
        // the Next.js site, and a second set of URLs would split SEO.
        'publicly_queryable' => false,
    ]);

    foreach (aerie_property_fields() as $key => $field) {
        register_post_meta('property', $key, [
            'type'         => $field['type'],
            'single'       => true,
            'default'      => '',
            'show_in_rest' => true,
            'sanitize_callback' => $field['single_line']
                ? 'sanitize_text_field'
                : 'wp_kses_post',
            // Only someone who can edit the post may change its meta.
            'auth_callback' => static fn(): bool => current_user_can('edit_posts'),
        ]);
    }
}
add_action('init', 'aerie_register_property_post_type');

/**
 * Mirrors the meta into an `acf`-shaped object on the REST response.
 *
 * The front end reads `acf.*` first and `meta.*` second, so sites that do run
 * Advanced Custom Fields and sites that run only this plugin both work without
 * a front-end change.
 */
function aerie_register_rest_fields(): void
{
    register_rest_field('property', 'acf', [
        'get_callback' => static function (array $post): array {
            $out = [];
            foreach (array_keys(aerie_property_fields()) as $key) {
                $out[$key] = get_post_meta($post['id'], $key, true);
            }
            return $out;
        },
        'schema' => [
            'description' => __('Property fields for the headless front end.', AERIE_TEXT_DOMAIN),
            'type'        => 'object',
        ],
    ]);
}
add_action('rest_api_init', 'aerie_register_rest_fields');

/**
 * Editor UI for the fields.
 *
 * A metabox rather than a block, deliberately: these are structured values the
 * front end lays out itself, not content an editor should be able to reposition.
 */
function aerie_add_meta_box(): void
{
    add_meta_box(
        'aerie_property_fields',
        __('Front-end fields', AERIE_TEXT_DOMAIN),
        'aerie_render_meta_box',
        'property',
        'normal',
        'high'
    );
}
add_action('add_meta_boxes', 'aerie_add_meta_box');

function aerie_render_meta_box(WP_Post $post): void
{
    wp_nonce_field('aerie_save_property', 'aerie_property_nonce');

    foreach (aerie_property_fields() as $key => $field) {
        $value = get_post_meta($post->ID, $key, true);
        printf('<p><label for="%1$s"><strong>%2$s</strong></label><br />', esc_attr($key), esc_html($field['label']));

        if ($field['single_line']) {
            printf(
                '<input type="text" id="%1$s" name="%1$s" value="%2$s" class="widefat" />',
                esc_attr($key),
                esc_attr((string) $value)
            );
        } else {
            printf(
                '<textarea id="%1$s" name="%1$s" rows="5" class="widefat">%2$s</textarea>',
                esc_attr($key),
                esc_textarea((string) $value)
            );
        }

        echo '</p>';
    }

    echo '<p class="description">'
        . esc_html__('The OwnerRez property ID links this copy to a home. Find it in OwnerRez under Properties — it is the number in the URL.', AERIE_TEXT_DOMAIN)
        . '</p>';
}

/**
 * Saves the metabox.
 *
 * Nonce, autosave and capability are all checked: a save handler that skips any
 * of the three is a privilege-escalation bug, not a shortcut.
 */
function aerie_save_property(int $post_id): void
{
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
        return;
    }

    $nonce = isset($_POST['aerie_property_nonce'])
        ? sanitize_text_field(wp_unslash($_POST['aerie_property_nonce']))
        : '';

    if ($nonce === '' || !wp_verify_nonce($nonce, 'aerie_save_property')) {
        return;
    }

    if (!current_user_can('edit_post', $post_id)) {
        return;
    }

    foreach (aerie_property_fields() as $key => $field) {
        if (!isset($_POST[$key])) {
            continue;
        }

        $raw = wp_unslash($_POST[$key]);
        $clean = $field['single_line']
            ? sanitize_text_field($raw)
            : wp_kses_post($raw);

        update_post_meta($post_id, $key, $clean);
    }
}
add_action('save_post_property', 'aerie_save_property');

/**
 * Tells the front end to rebuild the pages this change affects.
 *
 * Fires on publish, update and unpublish (`transition_post_status` covers all
 * three, where `save_post` alone would miss a trashing). The request is fired
 * and forgotten — a slow or unreachable front end must never block an editor's
 * save.
 */
function aerie_revalidate_front_end(string $new_status, string $old_status, WP_Post $post): void
{
    // Nothing to do while a draft is still a draft.
    if ($new_status === 'draft' && $old_status === 'draft') {
        return;
    }

    if (wp_is_post_revision($post) || wp_is_post_autosave($post)) {
        return;
    }

    $endpoint = defined('AERIE_REVALIDATE_URL') ? AERIE_REVALIDATE_URL : getenv('AERIE_REVALIDATE_URL');
    $secret   = defined('AERIE_REVALIDATE_SECRET') ? AERIE_REVALIDATE_SECRET : getenv('AERIE_REVALIDATE_SECRET');

    if (!$endpoint || !$secret) {
        return;
    }

    $type = match ($post->post_type) {
        'post'     => 'post',
        'page'     => 'page',
        'property' => 'property',
        default    => null,
    };

    if ($type === null) {
        return;
    }

    wp_remote_post($endpoint, [
        'timeout'  => 5,
        // Fire and forget: the editor should not wait on a cache purge.
        'blocking' => false,
        'headers'  => [
            'Content-Type'         => 'application/json',
            'X-Revalidate-Secret'  => $secret,
        ],
        'body' => wp_json_encode([
            'type' => $type,
            'slug' => $post->post_name,
        ]),
    ]);
}
add_action('transition_post_status', 'aerie_revalidate_front_end', 10, 3);

/**
 * Points the "View"/"Preview" links at the Next.js site instead of WordPress,
 * which has no front end of its own here.
 *
 * The two filters disagree on their second argument — `post_link` passes a
 * WP_Post, `page_link` passes a post ID — so it is normalised here rather than
 * type-hinted, which would fatal on pages.
 */
function aerie_front_end_permalink(string $permalink, WP_Post|int $post): string
{
    $site = defined('AERIE_FRONTEND_URL') ? AERIE_FRONTEND_URL : getenv('AERIE_FRONTEND_URL');
    if (!$site) {
        return $permalink;
    }

    $post = get_post($post);
    if (!$post instanceof WP_Post) {
        return $permalink;
    }

    $base = rtrim((string) $site, '/');

    return match ($post->post_type) {
        'post'     => "{$base}/journal/{$post->post_name}",
        'page'     => "{$base}/{$post->post_name}",
        'property' => "{$base}/properties",
        default    => $permalink,
    };
}
add_filter('post_link', 'aerie_front_end_permalink', 10, 2);
add_filter('page_link', 'aerie_front_end_permalink', 10, 2);
