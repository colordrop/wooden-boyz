<?php
if (!defined('ABSPATH')) {
    exit;
}

class WB3D_Admin_Settings {

    public function __construct() {
        // Dodanie menu w kokpicie
        add_action('admin_menu', array($this, 'add_plugin_menu'));
        
        // Rejestracja ustawień globalnych cech
        add_action('admin_init', array($this, 'register_global_settings'));
        
        // Obsługa żądań POST (dodawanie, edycja i usuwanie modeli 3D)
        add_action('admin_init', array($this, 'handle_model_actions'));
        
        // Ładowanie skryptów i stylów w panelu admina
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_assets'));

        // Stylizacja ikony menu głównego w kokpicie
        add_action('admin_head', array($this, 'add_admin_menu_icon_style'));
    }

    public function add_plugin_menu() {
        add_menu_page(
            'Konfigurator 3D',
            'Konfigurator 3D',
            'manage_options',
            'wooden-boyz-3d-configurator',
            array($this, 'render_admin_dashboard'),
            plugins_url('colordrop_logo_new.svg', __FILE__),
            56
        );
    }

    public function add_admin_menu_icon_style() {
        ?>
        <style>
            #adminmenu .toplevel_page_wooden-boyz-3d-configurator .wp-menu-image img {
                width: 20px;
                height: 20px;
                opacity: 0.6;
                transition: opacity 0.1s ease-in-out;
            }
            #adminmenu .toplevel_page_wooden-boyz-3d-configurator:hover .wp-menu-image img,
            #adminmenu .toplevel_page_wooden-boyz-3d-configurator.wp-has-current-submenu .wp-menu-image img,
            #adminmenu .toplevel_page_wooden-boyz-3d-configurator.current .wp-menu-image img {
                opacity: 1;
            }
        </style>
        <?php
    }

    public function register_global_settings() {
        register_setting('wb3d_global_settings_group', 'wb3d_global_attributes');
        register_setting('wb3d_global_settings_group', 'wb3d_global_ar_title');
        register_setting('wb3d_global_settings_group', 'wb3d_global_ar_subtitle');
        register_setting('wb3d_global_settings_group', 'wb3d_global_inquiry_btn_text');
        register_setting('wb3d_global_settings_group', 'wb3d_global_assets_base_url');
    }

    public function enqueue_admin_assets($hook) {
        if ($hook !== 'toplevel_page_wooden-boyz-3d-configurator') {
            return;
        }

        // Ładowanie biblioteki mediów WordPressa
        wp_enqueue_media();
        
        // model-viewer do parsowania GLB w tle admina
        wp_enqueue_script('model-viewer', 'https://unpkg.com/@google/model-viewer@3.3.0/dist/model-viewer.min.js', array(), '3.3.0', true);

        // Skrypt parsera GLB i obsługi UI admina
        wp_enqueue_script('wb3d-admin-parser', WB3D_URL . 'admin/js/admin-parser.js', array('jquery'), time(), true);
        
        // Przekazanie adresu bazowego zasobów do skryptu admina
        wp_localize_script('wb3d-admin-parser', 'wb3dAdminSettings', array(
            'assetsBaseUrl' => get_option('wb3d_global_assets_base_url', content_url('colordrop/'))
        ));
        
        // Style dla panelu admina
        wp_enqueue_style('wb3d-admin-style', WB3D_URL . 'admin/css/admin-style.css', array(), time());
    }

    // OBSŁUGA ZAPISU I USUWANIA MODELI 3D (POST-Redirect-GET)
    public function handle_model_actions() {
        if (!is_admin() || !current_user_can('manage_options')) {
            return;
        }

        // 1. ZAPIS MODELU (DODAWANIE / EDYCJA)
        if (isset($_POST['wb3d_save_model'])) {
            check_admin_referer('wb3d_save_model_action', 'wb3d_model_nonce');

            $model_id = sanitize_text_field($_POST['model_id']);
            $model_name = sanitize_text_field($_POST['model_name']);
            $glb_url = esc_url_raw($_POST['wb3d_glb_url']);
            $usdz_url = isset($_POST['wb3d_usdz_url']) ? esc_url_raw($_POST['wb3d_usdz_url']) : '';
            $base_price = floatval($_POST['wb3d_base_price']);
            $camera_orbit = isset($_POST['wb3d_camera_orbit']) ? sanitize_text_field($_POST['wb3d_camera_orbit']) : 'auto auto auto';
            $camera_target = isset($_POST['wb3d_camera_target']) ? sanitize_text_field($_POST['wb3d_camera_target']) : 'auto auto auto';
            $ar_prompt_title = isset($_POST['wb3d_ar_prompt_title']) ? sanitize_text_field($_POST['wb3d_ar_prompt_title']) : '';
            $ar_prompt_subtitle = isset($_POST['wb3d_ar_prompt_subtitle']) ? sanitize_text_field($_POST['wb3d_ar_prompt_subtitle']) : '';
            $sidebar_title = isset($_POST['wb3d_sidebar_title']) ? sanitize_text_field($_POST['wb3d_sidebar_title']) : '';
            $sidebar_subtitle = isset($_POST['wb3d_sidebar_subtitle']) ? sanitize_text_field($_POST['wb3d_sidebar_subtitle']) : '';
            $product_url = isset($_POST['wb3d_product_url']) ? esc_url_raw($_POST['wb3d_product_url']) : '';
            $product_button_text = isset($_POST['wb3d_product_button_text']) ? sanitize_text_field($_POST['wb3d_product_button_text']) : '';
            $active_attributes_json = isset($_POST['wb3d_active_attributes_json']) ? $_POST['wb3d_active_attributes_json'] : '[]';
            $geometry_toggles = isset($_POST['wb3d_geometry_toggles']) ? $_POST['wb3d_geometry_toggles'] : '[]';
            $parsed_nodes = isset($_POST['wb3d_parsed_nodes']) ? $_POST['wb3d_parsed_nodes'] : '[]';

            if (empty($model_name) || empty($glb_url)) {
                wp_die('Błąd: Nazwa modelu oraz plik GLB są wymagane.');
            }

            $models = $this->get_models_list();

            // Jeśli dodajemy nowy model, tworzymy mu unikalne ID
            if (empty($model_id)) {
                $model_id = 'model_' . time();
            }

            // Aktualizacja lub dodanie modelu do tablicy
            $models[$model_id] = array(
                'id' => $model_id,
                'name' => $model_name,
                'glb_url' => $glb_url,
                'usdz_url' => $usdz_url,
                'base_price' => $base_price,
                'camera_orbit' => $camera_orbit,
                'camera_target' => $camera_target,
                'ar_prompt_title' => $ar_prompt_title,
                'ar_prompt_subtitle' => $ar_prompt_subtitle,
                'sidebar_title' => $sidebar_title,
                'sidebar_subtitle' => $sidebar_subtitle,
                'product_url' => $product_url,
                'product_button_text' => $product_button_text,
                'active_attributes' => json_decode(stripslashes($active_attributes_json), true) ?: array(),
                'geometry_toggles' => json_decode(stripslashes($geometry_toggles), true) ?: array(),
                'parsed_nodes' => json_decode(stripslashes($parsed_nodes), true) ?: array()
            );

            update_option('wb3d_models_list', $models);

            // Przekierowanie powrotne do listy modeli
            wp_redirect(admin_url('admin.php?page=wooden-boyz-3d-configurator&tab=models&message=saved'));
            exit;
        }

        // 2. USUWANIE MODELU
        if (isset($_GET['action']) && $_GET['action'] === 'delete' && isset($_GET['model_id'])) {
            check_admin_referer('wb3d_delete_model_' . $_GET['model_id']);

            $model_id = sanitize_text_field($_GET['model_id']);
            $models = $this->get_models_list();

            if (isset($models[$model_id])) {
                unset($models[$model_id]);
                update_option('wb3d_models_list', $models);
            }

            wp_redirect(admin_url('admin.php?page=wooden-boyz-3d-configurator&tab=models&message=deleted'));
            exit;
        }
    }

    // Pobranie listy modeli z opcji WP
    private function get_models_list() {
        $models = get_option('wb3d_models_list', array());
        if (!is_array($models)) {
            $models = array();
        }
        return $models;
    }

    // GŁÓWNY DASHBOARD WTYCZKI (WIDOK Z ZAKŁADKAMI)
    public function render_admin_dashboard() {
        $active_tab = isset($_GET['tab']) ? sanitize_key($_GET['tab']) : 'models';
        ?>
        <div class="wrap wb3d-admin-wrap">
            <h1 class="wp-heading-inline">Konfigurator Placów Zabaw 3D</h1>
            <hr class="wp-header-end">

            <!-- Zakładki nawigacyjne -->
            <h2 class="nav-tab-wrapper" style="margin-bottom: 20px;">
                <a href="?page=wooden-boyz-3d-configurator&tab=models" class="nav-tab <?php echo $active_tab === 'models' ? 'nav-tab-active' : ''; ?>">
                    <span class="dashicons dashicons-images-alt" style="margin-top: 4px;"></span> Modele 3D (Baza)
                </a>
                <a href="?page=wooden-boyz-3d-configurator&tab=global-attributes" class="nav-tab <?php echo $active_tab === 'global-attributes' ? 'nav-tab-active' : ''; ?>">
                    <span class="dashicons dashicons-admin-appearance" style="margin-top: 4px;"></span> Cechy Globalne (Kolory/Tekstury)
                </a>
            </h2>

            <?php
            // Wyświetlenie komunikatów o statusie
            if (isset($_GET['message'])) {
                if ($_GET['message'] === 'saved') {
                    echo '<div class="notice notice-success is-dismissible"><p>Model został zapisany pomyślnie.</p></div>';
                } elseif ($_GET['message'] === 'deleted') {
                    echo '<div class="notice notice-warning is-dismissible"><p>Model został usunięty.</p></div>';
                }
            }

            // Renderowanie zawartości aktywnej zakładki
            if ($active_tab === 'models') {
                $this->render_models_tab();
            } elseif ($active_tab === 'global-attributes') {
                $this->render_global_attributes_tab();
            }
            ?>
        </div>
        <?php
    }

    // ZAKŁADKA 1: MODELE 3D (LISTA / EDYTOR)
    private function render_models_tab() {
        $action = isset($_GET['action']) ? sanitize_key($_GET['action']) : 'list';
        $models = $this->get_models_list();

        if ($action === 'add' || $action === 'edit') {
            $model_id = isset($_GET['model_id']) ? sanitize_text_field($_GET['model_id']) : '';
            $model = array(
                'id' => '',
                'name' => '',
                'glb_url' => '',
                'usdz_url' => '',
                'base_price' => 0,
                'camera_orbit' => 'auto auto auto',
                'camera_target' => 'auto auto auto',
                'ar_prompt_title' => '',
                'ar_prompt_subtitle' => '',
                'sidebar_title' => '',
                'sidebar_subtitle' => '',
                'product_url' => '',
                'product_button_text' => '',
                'active_attributes' => array(),
                'geometry_toggles' => array(),
                'parsed_nodes' => array()
            );

            if ($action === 'edit' && isset($models[$model_id])) {
                $model = $models[$model_id];
            }

            $global_attrs_json = get_option('wb3d_global_attributes', '[]');
            $global_attrs = json_decode($global_attrs_json, true) ?: array();
            ?>
            <div class="wb3d-card">
                <h2><?php echo $action === 'add' ? 'Dodaj nowy model 3D' : 'Edytuj model: ' . esc_html($model['name']); ?></h2>
                
                <form method="post" action="" id="wb3d-model-form" class="wb3d-meta-box-container">
                    <?php wp_nonce_field('wb3d_save_model_action', 'wb3d_model_nonce'); ?>
                    <input type="hidden" name="model_id" value="<?php echo esc_attr($model['id']); ?>">
                    <input type="hidden" name="wb3d_save_model" value="1">
                    <!-- Szybki import/export z JSON i schowka -->
                    <div style="background: #f0f6fa; border-left: 4px solid #00a0d2; padding: 15px; margin-bottom: 25px; border-radius: 4px;">
                        <h3 style="margin-top: 0; font-size: 14px; font-weight: bold; color: #1d2327;">Kopiowanie i importowanie konfiguracji (JSON)</h3>
                        <p class="description" style="margin-bottom: 12px;">Możesz skopiować konfigurację tego modelu do schowka (aby przenieść ją na inną stronę), wkleić konfigurację bezpośrednio ze schowka lub załadować kod wygenerowany w pliku <code>tester.html</code>.</p>
                        
                        <div style="display: flex; gap: 10px; margin-bottom: 12px;">
                            <button type="button" class="button button-secondary" id="wb3d-export-model-clipboard-btn">
                                <span class="dashicons dashicons-clipboard" style="margin-top: 4px; margin-right: 4px;"></span> Kopiuj całą konfigurację do schowka
                            </button>
                            <button type="button" class="button button-secondary" id="wb3d-import-model-clipboard-btn">
                                <span class="dashicons dashicons-download" style="margin-top: 4px; margin-right: 4px;"></span> Wklej konfigurację ze schowka
                            </button>
                        </div>

                        <div style="border-top: 1px solid #dcdcde; padding-top: 12px; margin-top: 12px;">
                            <label style="font-weight: 500; font-size: 12px; color: #1d2327; display: block; margin-bottom: 6px;">Ręczne pole tekstowe JSON (opcjonalne):</label>
                            <textarea id="wb3d_import_json_input" style="width: 100%; height: 80px; font-family: monospace; font-size: 11px; border: 1px solid #8c8f94; border-radius: 4px;" placeholder='Wklej wygenerowany kod JSON...'></textarea>
                            <button type="button" class="button button-secondary" id="wb3d_import_json_btn" style="margin-top: 10px;">Wczytaj z powyższego pola JSON</button>
                        </div>
                    </div>

                    <table class="form-table">
                        <tr valign="top">
                            <th scope="row"><label for="model_name">Nazwa modelu (dla klienta):</label></th>
                            <td>
                                <input type="text" name="model_name" id="model_name" class="regular-text" value="<?php echo esc_attr($model['name']); ?>" required placeholder="np. Laura">
                            </td>
                        </tr>
                        <tr valign="top">
                            <th scope="row"><label for="wb3d_glb_url">Model 3D (Plik GLB):</label></th>
                            <td>
                                <input type="text" name="wb3d_glb_url" id="wb3d_glb_url" class="regular-text" value="<?php echo esc_url($model['glb_url']); ?>" required>
                                <button type="button" class="button button-secondary" id="wb3d_upload_glb_btn">Wybierz plik z biblioteki</button>
                                <p class="description">Wgraj plik GLB placu zabaw.</p>
                            </td>
                        </tr>
                        <tr valign="top">
                            <th scope="row"><label for="wb3d_usdz_url">Model AR dla iOS (Plik USDZ - Opcjonalnie):</label></th>
                            <td>
                                <input type="text" name="wb3d_usdz_url" id="wb3d_usdz_url" class="regular-text" value="<?php echo esc_url(!empty($model['usdz_url']) ? $model['usdz_url'] : ''); ?>">
                                <button type="button" class="button button-secondary" id="wb3d_upload_usdz_btn">Wybierz plik z biblioteki</button>
                                <p class="description">Wgraj plik USDZ dla pełnej obsługi AR na urządzeniach Apple (iOS / Safari).</p>
                            </td>
                        </tr>

                        <tr valign="top">
                            <th scope="row"><label for="wb3d_base_price">Cena bazowa placu (zł):</label></th>
                            <td>
                                <input type="number" step="0.01" name="wb3d_base_price" id="wb3d_base_price" class="small-text" value="<?php echo esc_attr($model['base_price']); ?>"> zł
                            </td>
                        </tr>
                        <tr valign="top">
                            <th scope="row"><label for="wb3d_camera_orbit">Początkowy kąt kamery (Orbit):</label></th>
                            <td>
                                <input type="text" name="wb3d_camera_orbit" id="wb3d_camera_orbit" class="regular-text" value="<?php echo esc_attr(!empty($model['camera_orbit']) ? $model['camera_orbit'] : 'auto auto auto'); ?>">
                                <p class="description">np. <code>45deg 75deg 10m</code>. Kąt obrotu kamery (theta, phi, odległość). Zostaw puste lub wpisz <code>auto auto auto</code> dla domyślnego. Możesz wygenerować te wartości w pliku <code>tester.html</code> i wkleić tutaj.</p>
                            </td>
                        </tr>
                        <tr valign="top">
                            <th scope="row"><label for="wb3d_camera_target">Punkt celowania kamery (Target):</label></th>
                            <td>
                                <input type="text" name="wb3d_camera_target" id="wb3d_camera_target" class="regular-text" value="<?php echo esc_attr(!empty($model['camera_target']) ? $model['camera_target'] : 'auto auto auto'); ?>">
                                <p class="description">np. <code>0m 1.2m 0m</code>. Punkt w przestrzeni, na który skierowany jest środek obiektywu kamery. Domyślnie <code>auto auto auto</code>.</p>
                            </td>
                        </tr>
                        <tr valign="top">
                            <th scope="row"><label for="wb3d_sidebar_title">Nagłówek panelu (Tytuł):</label></th>
                            <td>
                                <input type="text" name="wb3d_sidebar_title" id="wb3d_sidebar_title" class="regular-text" value="<?php echo esc_attr(isset($model['sidebar_title']) ? $model['sidebar_title'] : ''); ?>" placeholder="Skonfiguruj swój plac zabaw: %name%">
                                <p class="description">Nagłówek widoczny w prawym panelu konfiguratora. Użyj tagu <code>%name%</code>, aby wstawić nazwę modelu (np. <i>Skonfiguruj swój plac zabaw: %name%</i>).</p>
                            </td>
                        </tr>
                        <tr valign="top">
                            <th scope="row"><label for="wb3d_sidebar_subtitle">Podtytuł panelu:</label></th>
                            <td>
                                <input type="text" name="wb3d_sidebar_subtitle" id="wb3d_sidebar_subtitle" class="regular-text" style="width: 100%; max-width: 500px;" value="<?php echo esc_attr(isset($model['sidebar_subtitle']) ? $model['sidebar_subtitle'] : ''); ?>" placeholder="Dostosuj wybarwienie drewna, kolory akcesoriów oraz opcje geometryczne.">
                                <p class="description">Tekst opisowy pod nagłówkiem w prawym panelu konfiguratora.</p>
                            </td>
                        </tr>
                        <tr valign="top">
                            <th scope="row"><label for="wb3d_product_url">Adres URL strony produktu:</label></th>
                            <td>
                                <input type="text" name="wb3d_product_url" id="wb3d_product_url" class="regular-text" style="width: 100%; max-width: 500px;" value="<?php echo esc_attr(isset($model['product_url']) ? $model['product_url'] : ''); ?>" placeholder="np. /sklep/plac-zabaw-laura/">
                                <p class="description">Pełny adres URL lub ścieżka względna (np. <code>/sklep/plac-zabaw-laura/</code>) do strony produktu na sklepie. Jeśli pole zostanie puste, przycisk powrotu się nie wyświetli.</p>
                            </td>
                        </tr>
                        <tr valign="top">
                            <th scope="row"><label for="wb3d_product_button_text">Tekst przycisku powrotu do produktu:</label></th>
                            <td>
                                <input type="text" name="wb3d_product_button_text" id="wb3d_product_button_text" class="regular-text" style="width: 100%; max-width: 500px;" value="<?php echo esc_attr(isset($model['product_button_text']) ? $model['product_button_text'] : ''); ?>" placeholder="Wróć do opisu produktu">
                                <p class="description">Napis widoczny na przycisku przekierowującym na stronę produktu.</p>
                            </td>
                        </tr>
                    </table>

                    <hr class="wb3d-divider">

                    <script>var wb3dGlobalAttrsList = <?php echo get_option('wb3d_global_attributes', '[]'); ?>;</script>
                    <h3>Aktywne cechy kolorystyczne (globalne)</h3>
                    <p class="description">Zaznacz cechy kolorystyczne dostępne dla tego modelu. Możesz też ustalić ich zależność (np. pokazuj kolor deseczki tylko gdy huśtawka to deseczka).</p>
                    <div id="wb3d-active-attributes-container" class="wb3d-attributes-list" style="margin-bottom: 15px;">
                        <!-- Generowane dynamicznie przez JS -->
                    </div>
                    <input type="hidden" name="wb3d_active_attributes_json" id="wb3d_active_attributes_json" value="<?php echo esc_attr(json_encode($model['active_attributes'])); ?>">

                    <hr class="wb3d-divider">

                    <h3>Warianty Geometryczne (Togle i Dropdowny 3D)</h3>
                    <p class="description">Stwórz przełączniki widoczności modułów placu zabaw. Nazwy elementów 3D zostaną pobrane automatycznie z wgranego wyżej pliku GLB.</p>
                    
                    <div id="wb3d-geometry-toggles-container" class="wb3d-toggles-list">
                        <!-- Generowane przez JS -->
                    </div>

                    <button type="button" class="button button-secondary" id="wb3d-add-toggle-btn">
                        <span class="dashicons dashicons-plus-alt2" style="margin-top: 4px;"></span> Dodaj wariant geometryczny
                    </button>

                    <!-- Ukryte pola przesyłające dane struktury 3D oraz wariantów -->
                    <input type="hidden" name="wb3d_geometry_toggles" id="wb3d_geometry_toggles_input" value="<?php echo esc_attr(json_encode($model['geometry_toggles'])); ?>">
                    <input type="hidden" name="wb3d_parsed_nodes" id="wb3d_parsed_nodes_input" value="<?php echo esc_attr(json_encode($model['parsed_nodes'])); ?>">
                    
                    <!-- Niewidoczny model-viewer do parsowania GLB w locie -->
                    <div id="wb3d-hidden-parser-container" style="position: fixed; left: 0; top: 0; width: 1px; height: 1px; opacity: 0.01; pointer-events: none; z-index: -9999;"></div>

                    <div style="margin-top: 30px;">
                        <input type="submit" class="button button-primary button-large" value="Zapisz konfigurację modelu">
                        <a href="?page=wooden-boyz-3d-configurator&tab=models" class="button button-secondary button-large" style="margin-left: 10px;">Anuluj</a>
                    </div>
                </form>
            </div>
            <?php
        } else {
            // LISTA MODELI
            ?>
            <div class="wb3d-card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
                    <h2 style="margin: 0; border: none; padding: 0;">Baza Skonfigurowanych Modeli 3D</h2>
                    <a href="?page=wooden-boyz-3d-configurator&tab=models&action=add" class="button button-primary">
                        <span class="dashicons dashicons-plus" style="margin-top: 4px;"></span> Dodaj nowy model
                    </a>
                </div>
                
                <table class="wp-list-table widefat striped table-view-list">
                    <thead>
                        <tr>
                            <th scope="col" style="font-weight: bold;">Nazwa modelu</th>
                            <th scope="col" style="font-weight: bold;">Plik GLB</th>
                            <th scope="col" style="font-weight: bold;">Cena bazowa</th>
                            <th scope="col" style="font-weight: bold; width: 320px;">Wygenerowany Shortcode</th>
                            <th scope="col" style="font-weight: bold; width: 150px; text-align: right;">Akcje</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (empty($models)) : ?>
                            <tr>
                                <td colspan="5" class="italic">Brak skonfigurowanych modeli. Kliknij przycisk „Dodaj nowy model” powyżej.</td>
                            </tr>
                        <?php else : ?>
                            <?php foreach ($models as $mod) : ?>
                                <tr>
                                    <td><strong><?php echo esc_html($mod['name']); ?></strong></td>
                                    <td><span class="font-mono" style="font-size:11px; word-break:break-all;"><?php echo esc_html(basename($mod['glb_url'])); ?></span></td>
                                    <td><?php echo number_format($mod['base_price'], 2, ',', ' '); ?> zł</td>
                                    <td>
                                        <input type="text" class="regular-text code" style="width: 100%; font-size: 11px;" readonly value='[wooden_boyz_3d_configurator id="<?php echo esc_attr($mod['id']); ?>" cf7_id="WPISZ_ID_CF7"]' onclick="this.select();">
                                    </td>
                                    <td style="text-align: right;">
                                        <a href="?page=wooden-boyz-3d-configurator&tab=models&action=edit&model_id=<?php echo esc_attr($mod['id']); ?>" class="button button-small">Edytuj</a>
                                        <a href="<?php echo wp_nonce_url('admin.php?page=wooden-boyz-3d-configurator&tab=models&action=delete&model_id=' . esc_attr($mod['id']), 'wb3d_delete_model_' . $mod['id']); ?>" class="button button-small button-link-delete" onclick="return confirm('Czy na pewno chcesz usunąć ten model?');" style="color: #b32d2e; margin-left: 5px;">Usuń</a>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
            <?php
        }
    }

    // ZAKŁADKA 2: ATRYBUTY GLOBALNE (KOLORY/TEKSTURY)
    private function render_global_attributes_tab() {
        $attributes_json = get_option('wb3d_global_attributes', '[]');
        if (empty($attributes_json)) {
            $attributes_json = '[]';
        }
        ?>
        <form method="post" action="options.php" id="wb3d-global-settings-form">
            <?php settings_fields('wb3d_global_settings_group'); ?>
            <?php do_settings_sections('wb3d_global_settings_group'); ?>
            
            <!-- Ukryte pole przechowujące dane jako JSON -->
            <input type="hidden" name="wb3d_global_attributes" id="wb3d_global_attributes_input" value="<?php echo esc_attr($attributes_json); ?>">

            <div class="wb3d-card">
                <h2>Biblioteka Atrybutów Globalnych</h2>
                <p class="description">Zdefiniuj cechy (np. Wybarwienie drewna, kolor lin), które będą mogły być aktywowane w poszczególnych modelach placów zabaw.</p>
                
                <!-- Kopiowanie / Importowanie biblioteki globalnej ze schowka -->
                <div style="background: #f0f6fa; border-left: 4px solid #00a0d2; padding: 10px 15px; margin: 15px 0; border-radius: 4px; display: flex; align-items: center; gap: 15px; justify-content: space-between; max-width: 1000px;">
                    <span style="font-size: 13px; font-weight: 500; color: #1d2327;">Kopiowanie / Importowanie biblioteki atrybutów:</span>
                    <div style="display: flex; gap: 8px;">
                        <button type="button" class="button button-secondary" id="wb3d-export-global-clipboard-btn">
                            <span class="dashicons dashicons-clipboard" style="margin-top: 4px; margin-right: 4px;"></span> Kopiuj bibliotekę do schowka
                        </button>
                        <button type="button" class="button button-secondary" id="wb3d-import-global-clipboard-btn">
                            <span class="dashicons dashicons-download" style="margin-top: 4px; margin-right: 4px;"></span> Wklej bibliotekę ze schowka
                        </button>
                    </div>
                </div>
                
                <!-- Konfiguracja globalna tekstów i AR prompt -->
                <div style="background: #fdfdfd; border: 1px solid #c3c4c7; padding: 20px; margin: 20px 0; border-radius: 8px; max-width: 1000px; box-sizing: border-box; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                    <h3 style="margin-top: 0; font-size: 15px; border-bottom: 1px solid #e5e5e5; padding-bottom: 10px;">
                        <span class="dashicons dashicons-art" style="color: #dba61e; font-size: 20px; width: 20px; height: 20px; margin-top: -2px; margin-right: 5px; vertical-align: middle;"></span>
                        Globalna personalizacja zasobów, tekstów i widoku AR (Rozszerzona Rzeczywistość)
                    </h3>
                    
                    <div style="margin-bottom: 15px;">
                        <label for="wb3d_global_assets_base_url" style="display: block; font-weight: bold; margin-bottom: 5px;">Bazowa ścieżka / adres URL do zasobów FTP (np. GLB, tekstury):</label>
                        <input type="text" name="wb3d_global_assets_base_url" id="wb3d_global_assets_base_url" class="regular-text" value="<?php echo esc_attr(get_option('wb3d_global_assets_base_url', '')); ?>" style="width: 100%; max-width: 500px;" placeholder="np. <?php echo content_url('colordrop/'); ?>">
                        <p class="description">Umożliwia wklejanie względnych ścieżek (np. <code>models/laura.glb</code>) w konfiguracji zamiast długich adresów. Wtyczka automatycznie doklei tę bazę na początku. Domyślnie (gdy pole pozostanie puste): <code>wp-content/colordrop/</code>.</p>
                    </div>

                    <div style="border-top: 1px solid #e5e5e5; margin-top: 15px; padding-top: 15px; margin-bottom: 15px;">
                        <label for="wb3d_global_inquiry_btn_text" style="display: block; font-weight: bold; margin-bottom: 5px;">Tekst przycisku zapytania ofertowego (Front-end):</label>
                        <input type="text" name="wb3d_global_inquiry_btn_text" id="wb3d_global_inquiry_btn_text" class="regular-text" value="<?php echo esc_attr(get_option('wb3d_global_inquiry_btn_text', 'Zapytaj o tę konfigurację')); ?>" style="width: 100%; max-width: 500px;">
                        <p class="description">Napis na przycisku otwierającym formularz zapytania w prawym panelu konfiguratora (domyślnie: <i>Zapytaj o tę konfigurację</i>).</p>
                    </div>
                    
                    <div style="border-top: 1px solid #e5e5e5; margin-top: 15px; padding-top: 15px; margin-bottom: 15px;">
                        <label for="wb3d_global_ar_title" style="display: block; font-weight: bold; margin-bottom: 5px;">Tytuł komunikatu AR Prompt:</label>
                        <input type="text" name="wb3d_global_ar_title" id="wb3d_global_ar_title" class="regular-text" value="<?php echo esc_attr(get_option('wb3d_global_ar_title', 'Ustaw model w ogrodzie')); ?>" style="width: 100%; max-width: 500px;">
                        <p class="description">Tekst wyświetlany na ekranie telefonu podczas pozycjonowania modelu w AR.</p>
                    </div>
                    
                    <div style="border-top: 1px solid #e5e5e5; margin-top: 15px; padding-top: 15px; margin-bottom: 15px;">
                        <label for="wb3d_global_ar_subtitle" style="display: block; font-weight: bold; margin-bottom: 5px;">Treść pomocnicza AR Prompt:</label>
                        <input type="text" name="wb3d_global_ar_subtitle" id="wb3d_global_ar_subtitle" class="large-text" value="<?php echo esc_attr(get_option('wb3d_global_ar_subtitle', 'Skieruj telefon na ziemię lub trawę. Model osadzi się automatycznie po wykryciu powierzchni.')); ?>" style="width: 100%; max-width: 500px;">
                        <p class="description">Opis krok po kroku wyświetlany pod tytułem AR Prompt.</p>
                    </div>
                </div>

                <div id="wb3d-attributes-container" class="wb3d-attributes-list">
                    <!-- Dynamicznie generowane wiersze atrybutów przez JS -->
                </div>

                <button type="button" class="button button-secondary" id="wb3d-add-attribute-btn">
                    <span class="dashicons dashicons-plus-alt2" style="margin-top: 4px;"></span> Dodaj nowy atrybut globalny
                </button>
            </div>

            <?php submit_button('Zapisz atrybuty globalne'); ?>
        </form>
        <?php
    }
}
