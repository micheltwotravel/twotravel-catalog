<?php
/**
 * Two Travel – PERF-3 & PERF-4 WordPress snippets
 * Pegar en: Apariencia > Editor de temas > functions.php del child theme
 * O crear un plugin en /wp-content/plugins/two-travel-perf/two-travel-perf.php
 */

/* ─────────────────────────────────────────────
   PERF-4: Preload del hero image (homepage)
   El hero "cartagena..._resized-3.webp" se encuentra
   tarde porque es CSS background. Este preload lo
   adelanta para reducir LCP de 6.9s a < 2.5s.
───────────────────────────────────────────────── */
add_action( 'wp_head', function () {
    if ( ! is_front_page() ) return;

    // ⚠ Cambiar esta URL por la URL exacta del hero actual
    $hero_url = 'https://two.travel/wp-content/uploads/2024/01/cartagena-hero_resized-3.webp';
    echo '<link rel="preload" as="image" href="' . esc_url( $hero_url ) . '" fetchpriority="high">' . "\n";
}, 1 ); // priority 1 = lo más temprano posible


/* ─────────────────────────────────────────────
   PERF-3: Desencolar scripts que homepage no usa
   Reduce ~900 KB de JavaScript sin usar.
───────────────────────────────────────────────── */
add_action( 'wp_enqueue_scripts', function () {
    if ( ! is_front_page() ) return;

    // Google News / Reader Revenue Manager (Site Kit)
    // Cargar solo en páginas con subscriptions (ninguna hoy)
    wp_dequeue_script( 'googlesitekit-reader-revenue-manager' );

    // jQuery UI — solo en páginas que usan los widgets
    wp_dequeue_script( 'jquery-ui-core' );
    wp_dequeue_script( 'jquery-ui-sortable' );
    wp_dequeue_script( 'jquery-ui-draggable' );

    // Sticky sidebar
    wp_dequeue_script( 'sticky-sidebar' );
    wp_dequeue_script( 'ResizeSensor' );

    // Exclusive Addons for Elementor — solo donde se use
    wp_dequeue_script( 'exad-plugins' );
    wp_dequeue_script( 'exad-custom' );
    wp_dequeue_style( 'exad-plugins' );

}, 100 ); // priority alta para que corra después de que los plugins encolen


/* ─────────────────────────────────────────────
   PERF-4b: Logo sin fetchpriority alta
   El logo (938px PNG) tiene priority alta y compite
   con el hero. Quitársela es un filtro de output.
───────────────────────────────────────────────── */
add_filter( 'get_custom_logo', function ( $html ) {
    // Quitar fetchpriority="high" del logo si existe
    return str_replace( ' fetchpriority="high"', '', $html );
} );
