<?php
if (!defined('ABSPATH')) {
    exit;
}

class WB3D_Configurator_Public {

    public function __construct() {
        // Rejestracja shortcode'u
        add_shortcode('wooden_boyz_3d_configurator', array($this, 'render_configurator'));
        
        // Rejestracja skryptów i stylów w systemie WP
        add_action('wp_enqueue_scripts', array($this, 'register_public_assets'));
    }

    public function register_public_assets() {
        // Rejestrujemy model-viewer (Wersja 4.0.0 dla lepszej kompatybilności z AR)
        wp_register_script('model-viewer', 'https://unpkg.com/@google/model-viewer@4.0.0/dist/model-viewer.min.js', array(), '4.0.0', true);
        
        // Rejestrujemy FontAwesome dla ikon
        wp_register_style('font-awesome', 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css', array(), '6.4.0');
        
        // Rejestrujemy style wtyczki
        wp_register_style('wb3d-public-style', WB3D_URL . 'public/css/configurator.css', array(), time());
        
        // Rejestrujemy główny skrypt konfiguratora
        wp_register_script('wb3d-public-configurator', WB3D_URL . 'public/js/configurator.js', array('jquery'), time(), true);
    }

    // Renderowanie widoku 3D konfiguratora na bazie unikalnego shortcode'u
    public function render_configurator($atts) {
        // Parametry shortcode: [wooden_boyz_3d_configurator id="model_id" cf7_id="123"]
        $args = shortcode_atts(array(
            'id' => '',
            'cf7_id' => ''
        ), $atts);

        if (empty($args['id'])) {
            return '<div class="wb3d-error-msg"><p>Błąd: Brak podanego parametru ID modelu w shortcodzie. Użyj formatu: <code>[wooden_boyz_3d_configurator id="NAZWA_MODELU" cf7_id="ID_FORMULARZA"]</code></p></div>';
        }

        // Pobieramy bazę konfiguracji modeli
        $models = get_option('wb3d_models_list', array());
        if (!is_array($models) || !isset($models[$args['id']])) {
            return '<div class="wb3d-error-msg"><p>Błąd: Model o podanym ID: <code>' . esc_html($args['id']) . '</code> nie istnieje w bazie konfiguratora 3D.</p></div>';
        }

        $model = $models[$args['id']];
        $glb_url = set_url_scheme($this->resolve_asset_url($model['glb_url']));
        $usdz_url = !empty($model['usdz_url']) ? set_url_scheme($this->resolve_asset_url($model['usdz_url'])) : '';
        $base_price = floatval($model['base_price'] ?: 0);
        $ar_prompt_title = get_option('wb3d_global_ar_title', 'Ustaw model w ogrodzie');
        $ar_prompt_subtitle = get_option('wb3d_global_ar_subtitle', 'Skieruj telefon na ziemię lub trawę. Model osadzi się automatycznie po wykryciu powierzchni.');
        $active_attrs_ids = $model['active_attributes'] ?: array();
        $geometry_toggles = $model['geometry_toggles'] ?: array();

        // Pobranie globalnych atrybutów kolorystycznych
        $global_attrs_json = get_option('wb3d_global_attributes', '[]');
        $global_attrs = json_decode($global_attrs_json, true) ?: array();

        // Mapujemy aktywne atrybuty dla kompatybilności z dawnym płaskim formatem tablicy stringów
        $active_attrs_map = array();
        foreach ($active_attrs_ids as $item) {
            if (is_string($item)) {
                $active_attrs_map[$item] = array('id' => $item, 'showWhenToggle' => '', 'showWhenValue' => '');
            } else if (is_array($item) && isset($item['id'])) {
                $active_attrs_map[$item['id']] = $item;
            }
        }

        // Filtrujemy tylko te atrybuty, które są włączone dla tego modelu i dodajemy warunki wyświetlania
        $filtered_attrs = array();
        foreach ($global_attrs as $attr) {
            if (isset($active_attrs_map[$attr['id']])) {
                $config = $active_attrs_map[$attr['id']];
                $attr['showWhenToggle'] = isset($config['showWhenToggle']) ? $config['showWhenToggle'] : '';
                $attr['showWhenValue'] = isset($config['showWhenValue']) ? $config['showWhenValue'] : '';

                // Pobranie miniaturki dla każdej opcji, jeśli jest typu texture i ma attachmentId
                if (isset($attr['options']) && is_array($attr['options'])) {
                    foreach ($attr['options'] as &$opt) {
                        // Rozwiązujemy względne ścieżki tekstury względem globalnego adresu bazowego
                        $opt['value'] = $this->resolve_asset_url($opt['value']);
                        
                        $thumbnail_url = '';
                        if ($attr['type'] === 'texture' && !empty($opt['attachmentId'])) {
                            $thumb_src = wp_get_attachment_image_src(intval($opt['attachmentId']), 'thumbnail');
                            if ($thumb_src) {
                                $thumbnail_url = $thumb_src[0];
                            }
                        }
                        
                        // Jeśli nie ma przypisanego attachmentId w mediach WP i jest to tekstura obrazkowa, spróbuj znaleźć miniaturę w folderze /thumbnails/
                        if (empty($thumbnail_url) && $attr['type'] === 'texture') {
                            $val = $opt['value'];
                            if (preg_match('/\\.(jpg|jpeg|png)$/i', $val)) {
                                $last_slash = strrpos($val, '/');
                                if ($last_slash !== false) {
                                    $thumbnail_url = substr($val, 0, $last_slash) . '/thumbnails' . substr($val, $last_slash);
                                }
                            }
                        }
                        
                        // Jeśli nie udało się wyznaczyć miniaturki, używamy oryginalnego URL
                        $opt['thumbnailUrl'] = !empty($thumbnail_url) ? $thumbnail_url : $opt['value'];
                    }
                    unset($opt); // Sprzątamy referencję
                }

                $filtered_attrs[] = $attr;
            }
        }

        // Enqueue zarejestrowanych zasobów (ładujemy je tylko gdy shortcode faktycznie się wykonuje!)
        wp_enqueue_style('font-awesome');
        wp_enqueue_style('wb3d-public-style');
        wp_enqueue_script('wb3d-public-configurator');

        // Dane do wstrzyknięcia do data-attribute
        $config_data = array(
            'glbUrl' => esc_url($glb_url),
            'basePrice' => $base_price,
            'activeAttributes' => $filtered_attrs,
            'geometryToggles' => $geometry_toggles,
            'productName' => esc_html($model['name']),
            'productUrl' => isset($model['product_url']) ? esc_url($model['product_url']) : '',
            'productButtonText' => isset($model['product_button_text']) ? esc_html($model['product_button_text']) : ''
        );

        // Rozpoczęcie buforowania wyjściowego HTML
        ob_start();
        ?>
        <!-- Wczytywanie biblioteki model-viewer bezpośrednio jako moduł, aby uniknąć problemów z agregacją/minifikacją JS przez wtyczki cache -->
        <script type="module" src="https://unpkg.com/@google/model-viewer@4.0.0/dist/model-viewer.min.js"></script>

        <div class="wb3d-configurator-container">
            <script type="application/json" class="wb3d-config-json"><?php echo json_encode($config_data); ?></script>
            <!-- 1. Lewa kolumna: Podgląd 3D -->
            <div class="wb3d-viewport-column">
                <!-- Loader spinner -->
                <div class="wb3d-loader-overlay">
                    <div class="wb3d-spinner"></div>
                    <p>Wczytywanie modelu 3D placu zabaw...</p>
                </div>

                <model-viewer 
                    class="wb3d-viewer" 
                    src="<?php echo esc_url($glb_url); ?>" 
                    <?php if (!empty($usdz_url)) : ?>
                    ios-src="<?php echo esc_url($usdz_url); ?>"
                    <?php endif; ?>
                    bounds="tight"
                    camera-controls 
                    camera-orbit="<?php echo esc_attr(!empty($model['camera_orbit']) ? $model['camera_orbit'] : 'auto auto auto'); ?>" 
                    camera-target="<?php echo esc_attr(!empty($model['camera_target']) ? $model['camera_target'] : 'auto auto auto'); ?>" 
                    min-camera-orbit="auto 35deg auto"
                    max-camera-orbit="auto 95deg auto"
                    touch-action="pan-y"
                    shadow-intensity="0.85" 
                    environment-image="neutral"
                    interaction-prompt="auto"
                    ar
                    ar-modes="webxr scene-viewer quick-look"
                    ar-scale="fixed">
                    
                    <button slot="ar-button" class="wb3d-ar-button">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style="width: 16px; height: 16px; fill: currentColor; vertical-align: middle; margin-right: 8px; display: inline-block;"><path d="M96 0C60.7 0 32 28.7 32 64V448c0 35.3 28.7 64 64 64H416c35.3 0 64-28.7 64-64V64c0-35.3-28.7-64-64-64H96zM224 416a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/></svg> Zobacz w AR
                    </button>

                    <div id="wb3d-ar-prompt">
                        <div class="wb3d-ar-prompt-card">
                            <svg class="wb3d-ar-prompt-icon" width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                <rect x="2" y="4" width="12" height="30" rx="2.5" stroke="white" stroke-width="1.5" fill="rgba(255,255,255,0.16)"/>
                                <circle cx="8" cy="30" r="1.2" fill="white"/>
                                <path d="M16 19H21" stroke="white" stroke-width="2" stroke-linecap="round"/>
                                <path d="M19 16L22 19L19 22" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <rect x="23" y="10" width="13" height="18" rx="2.5" stroke="white" stroke-width="1.5" fill="rgba(255,255,255,0.16)"/>
                            </svg>
                            <div>
                                <p class="wb3d-ar-prompt-title"><?php echo esc_html($ar_prompt_title); ?></p>
                                <p class="wb3d-ar-prompt-subtitle"><?php echo esc_html($ar_prompt_subtitle); ?></p>
                            </div>
                        </div>
                    </div>

                    <!-- Pływający przełącznik animacji piaskownicy (uproszczony, na środku na górze viewportu) -->
                    <div id="wb3d-sandbox-anim-toggle" class="wb3d-sandbox-anim-toggle" style="display: none;">
                        <div class="wb3d-sat-card" id="wb3d-sat-card">
                            <span class="wb3d-sat-label">Otwórz / zamknij</span>
                            <label class="wb3d-sat-switch">
                                <input type="checkbox" id="wb3d-sat-checkbox">
                                <span class="wb3d-sat-slider"></span>
                            </label>
                        </div>
                    </div>
                </model-viewer>
            </div>

            <!-- 2. Prawa kolumna: Panele konfiguracji -->
            <div class="wb3d-sidebar-column">
                <div class="wb3d-panel-scroll">
                    <?php
                    $sidebar_title = !empty($model['sidebar_title']) ? $model['sidebar_title'] : 'Skonfiguruj swój plac zabaw: %name%';
                    $sidebar_title = str_replace('%name%', $model['name'], $sidebar_title);
                    
                    $sidebar_subtitle = isset($model['sidebar_subtitle']) && $model['sidebar_subtitle'] !== '' ? $model['sidebar_subtitle'] : 'Dostosuj wybarwienie drewna, kolory akcesoriów oraz opcje geometryczne.';
                    ?>
                    <h2><?php echo esc_html($sidebar_title); ?></h2>
                    <?php if (!empty($sidebar_subtitle)) : ?>
                    <p class="wb3d-subtitle"><?php echo esc_html($sidebar_subtitle); ?></p>
                    <?php endif; ?>

                    <!-- Sekcja orientacji placu zabaw (Standardowa - Prawa / Odbicie lustrzane - Lewa) -->
                    <div class="wb3d-ui-section-geo wb3d-step-section" id="wb3d-section-orientation">
                        <div class="wb3d-select-group">
                            <div class="wb3d-select-label-row">
                                <strong>Orientacja placu zabaw:</strong>
                            </div>
                            <select class="wb3d-geo-select" id="wb3d-orientation-select">
                                <option value="standard" selected>Prawa (standardowa)</option>
                                <option value="mirrored">Lewa (odbicie lustrzane)</option>
                            </select>
                        </div>
                    </div>

                    <!-- Kontener na dynamiczne swatche kolorystyczne (wstrzykiwane przez JS) -->
                    <div class="wb3d-materials-container wb3d-step-section">
                        <!-- Generowane dynamicznie przez JS -->
                    </div>

                    <!-- Kontener na dynamiczne warianty geometryczne (wstrzykiwane przez JS) -->
                    <div class="wb3d-geometry-container wb3d-step-section">
                        <!-- Generowane dynamicznie przez JS -->
                    </div>

                    <!-- Przycisk otwierający popup zapytania -->
                    <div class="wb3d-inquiry-section wb3d-step-section">
                        <?php
                        $inquiry_btn_text = get_option('wb3d_global_inquiry_btn_text', 'Zapytaj o tę konfigurację');
                        if (empty($inquiry_btn_text)) {
                            $inquiry_btn_text = 'Zapytaj o tę konfigurację';
                        }
                        ?>
                        <button type="button" class="wb3d-trigger-modal-btn" id="wb3d-trigger-inquiry-modal">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style="width: 16px; height: 16px; fill: currentColor; vertical-align: middle; margin-right: 8px; display: inline-block;"><path d="M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48H48zM0 176V384c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V176L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z"/></svg> <?php echo esc_html($inquiry_btn_text); ?>
                        </button>

                        <?php
                        $product_url = isset($model['product_url']) ? $model['product_url'] : '';
                        if (!empty($product_url)) :
                            $product_btn_text = !empty($model['product_button_text']) ? $model['product_button_text'] : 'Wróć do opisu produktu';
                        ?>
                            <button type="button" class="wb3d-trigger-modal-btn wb3d-product-link-btn" onclick="window.location.href='<?php echo esc_js($product_url); ?>'">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" style="width: 14px; height: 14px; fill: currentColor; vertical-align: middle; display: inline-block; margin-right: 4px;"><path d="M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L109.2 288H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H109.3L214.7 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160z"/></svg> <?php echo esc_html($product_btn_text); ?>
                            </button>
                        <?php endif; ?>
                    </div>
                </div>
                
                <!-- Dolny pasek podsumowania ceny przeniesiony do prawego panelu -->
                <div class="wb3d-price-bar">
                    <div class="wb3d-price-summary">
                        <div class="wb3d-price-item">
                            <span class="wb3d-label">Cena bazowa</span>
                            <span class="wb3d-value wb3d-base-price-display">0,00 zł</span>
                        </div>
                        <div class="wb3d-price-sep">|</div>
                        <div class="wb3d-price-item">
                            <span class="wb3d-label">Wybrane dodatki</span>
                            <span class="wb3d-value wb3d-extras-price-display">0,00 zł</span>
                        </div>
                        <div class="wb3d-price-sep">|</div>
                        <div class="wb3d-price-item">
                            <span class="wb3d-label">Cena całkowita</span>
                            <span class="wb3d-value-total wb3d-total-price-display">0,00 zł</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal zapytania (Popup) -->
        <div id="wb3d-inquiry-modal" class="wb3d-modal" style="display: none;">
            <div class="wb3d-modal-overlay" id="wb3d-modal-overlay-el"></div>
            <div class="wb3d-modal-content">
                <button type="button" class="wb3d-modal-close" id="wb3d-modal-close-btn">&times;</button>
                <h3>Zapytaj o tę konfigurację</h3>
                <p class="wb3d-modal-desc">Wyślij zapytanie do obsługi sklepu. Wygenerowany zrzut ekranu Twojej konfiguracji zostanie dołączony automatycznie do maila.</p>
                
                <div class="wb3d-modal-form-wrapper">
                    <?php 
                    if (!empty($args['cf7_id'])) {
                        echo do_shortcode('[contact-form-7 id="' . esc_attr($args['cf7_id']) . '"]'); 
                    } else {
                        echo '<p class="wb3d-warning-msg">Błąd: Brak podanego id formularza Contact Form 7. Wklej go w formacie: <code>[wooden_boyz_3d_configurator id="' . esc_attr($args['id']) . '" cf7_id="NUMER_ID"]</code></p>';
                    }
                    ?>
                </div>
            </div>
        </div>

        <?php
        return ob_get_clean();
    }

    private function resolve_asset_url($path) {
        if (empty($path)) {
            return '';
        }
        
        // Jeśli to jest kod koloru HEX (np. #085ba9) lub pełny adres URL/bezwzględna ścieżka:
        if (strpos($path, '#') === 0 || strpos($path, 'http://') === 0 || strpos($path, 'https://') === 0 || strpos($path, '//') === 0 || strpos($path, '/') === 0) {
            return $path;
        }
        
        // Pobieramy bazowy URL z opcji globalnych
        $base_url = get_option('wb3d_global_assets_base_url', '');
        if (empty($base_url)) {
            // Domyślny fallback: /wp-content/colordrop/
            $base_url = content_url('colordrop/');
        }
        
        // Upewniamy się, że bazowy URL kończy się slashem
        $base_url = trailingslashit($base_url);
        
        return $base_url . $path;
    }
}
