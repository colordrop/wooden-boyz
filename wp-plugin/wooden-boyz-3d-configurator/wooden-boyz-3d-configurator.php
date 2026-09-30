<?php
/**
 * Plugin Name: Wooden Boyz 3D Configurator
 * Description: Interaktywny konfigurator placów zabaw 3D zintegrowany z Contact Form 7 i zrzutami ekranu.
 * Version: 1.2.3
 * Author: colordrop.pl
 * Text Domain: wooden-boyz-3d-configurator
 */

if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly
}

// Definiowanie stałych wtyczki
define('WB3D_PATH', plugin_dir_path(__FILE__));
define('WB3D_URL', plugin_dir_url(__FILE__));
define('WB3D_VERSION', '1.2.3');

// Włączenie obsługi wgrywania plików .glb i .gltf w bibliotece mediów WordPressa
add_filter('upload_mimes', 'wb3d_allow_glb_gltf_uploads');
function wb3d_allow_glb_gltf_uploads($mimes) {
    $mimes['glb'] = 'model/gltf-binary';
    $mimes['gltf'] = 'model/gltf+json';
    return $mimes;
}

// Rozwiązanie problemu z błędnym wykrywaniem typu pliku (wp_check_filetype_and_ext) w nowszych wersjach WP
add_filter('wp_check_filetype_and_ext', 'wb3d_check_filetype', 10, 4);
function wb3d_check_filetype($data, $file, $filename, $mimes) {
    $ext = pathinfo($filename, PATHINFO_EXTENSION);
    if ($ext === 'glb') {
        $data['ext'] = 'glb';
        $data['type'] = 'model/gltf-binary';
    } elseif ($ext === 'gltf') {
        $data['ext'] = 'gltf';
        $data['type'] = 'model/gltf+json';
    }
    return $data;
}

// Załadowanie plików rdzenia
require_once WB3D_PATH . 'admin/admin-settings.php';
require_once WB3D_PATH . 'public/class-configurator-public.php';

// Inicjalizacja komponentów
if (is_admin()) {
    new WB3D_Admin_Settings();
}
new WB3D_Configurator_Public();

// Dodanie atrybutu type="module" do skryptu model-viewer w celu uniknięcia błędów składni (Unexpected token 'export')
add_filter('script_loader_tag', 'wb3d_add_module_attribute', 10, 3);
function wb3d_add_module_attribute($tag, $handle, $src) {
    if ('model-viewer' === $handle) {
        $tag = '<script type="module" id="model-viewer-js" src="' . esc_url($src) . '"></script>';
    }
    return $tag;
}
