jQuery(document).ready(function($) {

    function resolveAdminAssetUrl(path) {
        if (!path) return '';
        if (path.indexOf('http://') === 0 || path.indexOf('https://') === 0 || path.indexOf('//') === 0 || path.indexOf('/') === 0) {
            return path;
        }
        var baseUrl = typeof wb3dAdminSettings !== 'undefined' ? wb3dAdminSettings.assetsBaseUrl : '/wp-content/colordrop/';
        if (baseUrl && !baseUrl.endsWith('/')) {
            baseUrl += '/';
        }
        return baseUrl + path;
    }

    // =================================================================
    // PART 1: GLOBAL SETTINGS REPEATER PAGE
    // =================================================================

    if ($('#wb3d-attributes-container').length) {
        var globalAttrs = [];
        try {
            globalAttrs = JSON.parse($('#wb3d_global_attributes_input').val() || '[]');
        } catch (e) {
            console.error("Błąd parsowania atrybutów globalnych", e);
        }

        function renderGlobalAttributes() {
            var $container = $('#wb3d-attributes-container');
            $container.empty();

            globalAttrs.forEach(function(attr, idx) {
                var optionsHtml = '';
                
                if (attr.options && attr.options.length) {
                    attr.options.forEach(function(opt, optIdx) {
                        var previewHtml = '';
                        var colorPickerHtml = '';
                        if (attr.type === 'color') {
                            previewHtml = `<span class="wb3d-color-preview" style="background-color: ${opt.value};"></span>`;
                            colorPickerHtml = `<input type="color" class="wb3d-opt-color-picker" value="${opt.value || '#ffffff'}" style="width: 40px; height: 30px; padding: 0; border: 1px solid #ccc; cursor: pointer; border-radius: 4px; vertical-align: middle; margin-right: 5px;">`;
                        } else {
                            var resolvedUrl = resolveAdminAssetUrl(opt.value);
                            previewHtml = `<span class="wb3d-image-preview" style="background-image: url(${resolvedUrl});"></span>`;
                        }

                        var isChecked = opt.isDefault ? 'checked' : '';
                        if (attr.options.length === 1) {
                            isChecked = 'checked';
                        }
                        var radioHtml = `
                            <label style="font-size: 11px; color:#646970; display: inline-flex; align-items: center; gap: 3px; cursor: pointer; margin-right: 5px;" title="Ustaw tę opcję jako domyślnie wybraną na starcie">
                                <input type="radio" name="wb3d-default-option-${idx}" class="wb3d-opt-default" ${isChecked}> Dom.
                            </label>
                        `;

                        optionsHtml += `
                            <div class="wb3d-option-row" data-opt-idx="${optIdx}" data-attachment-id="${opt.attachmentId || ''}">
                                ${previewHtml}
                                <input type="text" placeholder="Nazwa opcji (np. Czerwony)" class="wb3d-opt-name" value="${opt.name}" style="width: 150px;">
                                <input type="text" placeholder="Wartość (Hex lub URL)" class="wb3d-opt-val" value="${opt.value}" style="width: 200px;">
                                ${colorPickerHtml}
                                ${radioHtml}
                                <button type="button" class="button button-secondary wb3d-select-media-btn ${attr.type === 'color' ? 'hidden' : ''}">Wgraj</button>
                                <button type="button" class="wb3d-remove-btn wb3d-remove-opt-btn"><span class="dashicons dashicons-trash"></span></button>
                            </div>
                        `;
                    });
                }

                var cardHtml = `
                    <div class="wb3d-attribute-item" data-idx="${idx}">
                        <div class="wb3d-attribute-item-header">
                            <strong>Nazwa:</strong>
                            <input type="text" class="wb3d-attr-name" value="${attr.name}" placeholder="np. Kolor ślizgu" style="width: 200px;">
                            <strong>ID w 3D:</strong>
                            <input type="text" class="wb3d-attr-id" value="${attr.id}" placeholder="np. kolor-slizg" style="width: 150px;">
                            <strong>Typ:</strong>
                            <select class="wb3d-attr-type">
                                <option value="color" ${attr.type === 'color' ? 'selected' : ''}>Płaski kolor (RGB)</option>
                                <option value="texture" ${attr.type === 'texture' ? 'selected' : ''}>Wybarwienie (Tekstura JPG)</option>
                            </select>
                            <button type="button" class="button button-secondary wb3d-duplicate-attr-btn" style="margin-left: auto;">
                                <span class="dashicons dashicons-admin-page" style="margin-top: 4px;"></span> Duplikuj
                            </button>
                            <button type="button" class="wb3d-remove-btn wb3d-remove-attr-btn" style="margin-left: 10px;">
                                <span class="dashicons dashicons-trash"></span> Usuń atrybut
                            </button>
                        </div>
                        
                        <div class="wb3d-options-sublist">
                            <h4>Dostępne Warianty</h4>
                            <div class="wb3d-options-rows-container">
                                ${optionsHtml}
                            </div>
                            <button type="button" class="button button-small wb3d-add-opt-btn" style="margin-top: 10px;">
                                <span class="dashicons dashicons-plus-alt"></span> Dodaj wariant
                            </button>
                        </div>
                    </div>
                `;
                $container.append(cardHtml);
            });

            // Inicjalizacja color pickerów
            initWordPressColorPickers();
        }

        // Pobranie danych wpisanych w formularzu atrybutów i zapisanie ich do pamięci
        function saveGlobalAttrsFromDOM() {
            $('.wb3d-attribute-item').each(function() {
                var $item = $(this);
                var idx = $item.data('idx');
                if (globalAttrs[idx]) {
                    globalAttrs[idx].id = $item.find('.wb3d-attr-id').val().trim();
                    globalAttrs[idx].name = $item.find('.wb3d-attr-name').val().trim();
                    globalAttrs[idx].type = $item.find('.wb3d-attr-type').val();
                    
                    var options = [];
                    $item.find('.wb3d-option-row').each(function() {
                        var $row = $(this);
                        options.push({
                            name: $row.find('.wb3d-opt-name').val().trim(),
                            value: $row.find('.wb3d-opt-val').val().trim(),
                            isDefault: $row.find('.wb3d-opt-default').is(':checked'),
                            attachmentId: $row.attr('data-attachment-id') || ''
                        });
                    });
                    globalAttrs[idx].options = options;
                }
            });
        }

        function initWordPressColorPickers() {
            $('.wb3d-option-row').each(function() {
                var $row = $(this);
                var $attrItem = $row.closest('.wb3d-attribute-item');
                var idx = $attrItem.data('idx');
                if (globalAttrs[idx]) {
                    if (globalAttrs[idx].type === 'color') {
                        // 1. Wpisanie Hexa aktualizuje picker i kropkę podglądu
                        $row.find('.wb3d-opt-val').on('input', function() {
                            var val = $(this).val().trim();
                            if (/^#[0-9A-F]{6}$/i.test(val) || /^#[0-9A-F]{3}$/i.test(val)) {
                                $row.find('.wb3d-opt-color-picker').val(val);
                                $row.find('.wb3d-color-preview').css('background-color', val);
                            }
                        });

                        // 2. Kliknięcie w picker aktualizuje pole tekstowe i kropkę podglądu
                        $row.find('.wb3d-opt-color-picker').on('input change', function() {
                            var val = $(this).val();
                            $row.find('.wb3d-opt-val').val(val);
                            $row.find('.wb3d-color-preview').css('background-color', val);
                        });
                    } else {
                        // Wpisanie ścieżki ręcznie aktualizuje podgląd graficzny
                        $row.find('.wb3d-opt-val').on('input', function() {
                            var val = $(this).val().trim();
                            var resolvedUrl = resolveAdminAssetUrl(val);
                            $row.find('.wb3d-image-preview').css('background-image', 'url(' + resolvedUrl + ')');
                        });
                    }
                }
            });
        }

        // Zapisywanie stanu DOM do JSON przed wysłaniem formularza
        $('#wb3d-global-settings-form').on('submit', function() {
            saveGlobalAttrsFromDOM();
            
            var output = globalAttrs.filter(function(attr) {
                return attr.id && attr.name;
            });

            $('#wb3d_global_attributes_input').val(JSON.stringify(output));
        });

        // Dodawanie nowego atrybutu globalnego
        $('#wb3d-add-attribute-btn').on('click', function() {
            saveGlobalAttrsFromDOM();
            globalAttrs.push({
                id: 'nowy-atrybut-' + Date.now(),
                name: 'Nowy atrybut',
                type: 'color',
                options: []
            });
            renderGlobalAttributes();
        });

        // Usuwanie atrybutu
        $(document).on('click', '.wb3d-remove-attr-btn', function() {
            saveGlobalAttrsFromDOM();
            var idx = $(this).closest('.wb3d-attribute-item').data('idx');
            globalAttrs.splice(idx, 1);
            renderGlobalAttributes();
        });

        // Duplikowanie atrybutu
        $(document).on('click', '.wb3d-duplicate-attr-btn', function() {
            saveGlobalAttrsFromDOM();
            var idx = $(this).closest('.wb3d-attribute-item').data('idx');
            
            // Głęboka kopia obiektu atrybutu
            var original = globalAttrs[idx];
            var clone = JSON.parse(JSON.stringify(original));
            
            // Unikalne wartości dla kopii
            clone.id = clone.id + '-kopia';
            clone.name = clone.name + ' (Kopia)';
            
            // Wstawienie kopii zaraz po oryginalnym elemencie
            globalAttrs.splice(idx + 1, 0, clone);
            
            renderGlobalAttributes();
        });

        // Zmiana typu atrybutu
        $(document).on('change', '.wb3d-attr-type', function() {
            saveGlobalAttrsFromDOM();
            var idx = $(this).closest('.wb3d-attribute-item').data('idx');
            globalAttrs[idx].type = $(this).val();
            globalAttrs[idx].options = [];
            renderGlobalAttributes();
        });

        // Dodawanie wariantu
        $(document).on('click', '.wb3d-add-opt-btn', function() {
            saveGlobalAttrsFromDOM();
            var idx = $(this).closest('.wb3d-attribute-item').data('idx');
            if (!globalAttrs[idx].options) {
                globalAttrs[idx].options = [];
            }
            globalAttrs[idx].options.push({
                name: 'Opcja',
                value: globalAttrs[idx].type === 'color' ? '#ffffff' : ''
            });
            renderGlobalAttributes();
        });

        // Usuwanie opcji
        $(document).on('click', '.wb3d-remove-opt-btn', function() {
            saveGlobalAttrsFromDOM();
            var idx = $(this).closest('.wb3d-attribute-item').data('idx');
            var optIdx = $(this).closest('.wb3d-option-row').data('opt-idx');
            globalAttrs[idx].options.splice(optIdx, 1);
            renderGlobalAttributes();
        });

        // Zmiana domyślnej opcji
        $(document).on('change', '.wb3d-opt-default', function() {
            saveGlobalAttrsFromDOM();
        });

        // Wybór tekstury z WordPress Media Uploader
        $(document).on('click', '.wb3d-select-media-btn', function(e) {
            e.preventDefault();
            var $btn = $(this);
            var $row = $btn.closest('.wb3d-option-row');
            
            var file_frame = wp.media.frames.file_frame = wp.media({
                title: 'Wybierz teksturę wybarwienia',
                button: { text: 'Użyj tej tekstury' },
                multiple: false
            });

            file_frame.on('select', function() {
                var attachment = file_frame.state().get('selection').first().toJSON();
                $row.find('.wb3d-opt-val').val(attachment.url);
                $row.attr('data-attachment-id', attachment.id);
                $row.find('.wb3d-image-preview').css('background-image', `url(${attachment.url})`);
                saveGlobalAttrsFromDOM();
            });

            file_frame.open();
        });

        // Kopiowanie biblioteki atrybutów globalnych do schowka
        $('#wb3d-export-global-clipboard-btn').on('click', function() {
            saveGlobalAttrsFromDOM();
            var json = JSON.stringify(globalAttrs, null, 2);
            navigator.clipboard.writeText(json).then(function() {
                alert('Biblioteka atrybutów została skopiowana do schowka!');
            }).catch(function(err) {
                alert('Błąd kopiowania do schowka.');
                console.error(err);
            });
        });

        // Wklejanie biblioteki atrybutów globalnych ze schowka (bezpośredni odczyt)
        $('#wb3d-import-global-clipboard-btn').on('click', function() {
            navigator.clipboard.readText().then(function(rawJson) {
                if (!rawJson) {
                    alert('Schowek jest pusty!');
                    return;
                }
                try {
                    var imported = JSON.parse(rawJson);
                    if (Array.isArray(imported)) {
                        globalAttrs = imported;
                        renderGlobalAttributes();
                        alert('Biblioteka atrybutów została pomyślnie załadowana ze schowka! Pamiętaj, aby kliknąć "Zapisz atrybuty globalne" na dole strony.');
                    } else {
                        alert('Błąd: Kod w schowku musi być tablicą atrybutów.');
                    }
                } catch (e) {
                    alert('Błąd parsowania danych ze schowka. Upewnij się, że skopiowałeś poprawną bibliotekę atrybutów.');
                    console.error(e);
                }
            }).catch(function(err) {
                alert('Brak uprawnień do odczytu schowka. Zezwól przeglądarce na dostęp.');
                console.error(err);
            });
        });

        // Inicjalne renderowanie
        renderGlobalAttributes();
    }

    // =================================================================
    // PART 2: PRODUCT METABOX & GLB PARSER
    // =================================================================

    if ($('#wb3d-geometry-toggles-container').length) {
        var geometryToggles = [];
        var parsedNodes = [];
        var activeAttributes = [];

        try {
            geometryToggles = JSON.parse($('#wb3d_geometry_toggles_input').val() || '[]');
        } catch (e) {
            console.error("Błąd parsowania wariantów geometrycznych", e);
        }

        try {
            parsedNodes = JSON.parse($('#wb3d_parsed_nodes_input').val() || '[]');
        } catch (e) {
            console.error("Błąd parsowania węzłów GLB", e);
        }

        try {
            activeAttributes = JSON.parse($('#wb3d_active_attributes_json').val() || '[]').map(function(item) {
                if (typeof item === 'string') {
                    return { id: item, showWhenToggle: '', showWhenValue: '' };
                }
                return item;
            });
        } catch (e) {
            console.error("Błąd parsowania aktywnych atrybutów", e);
        }

        function loadModelConfigData(data) {
            if (data.name) {
                $('#model_name').val(data.name);
            }
            if (data.parsed_nodes && Array.isArray(data.parsed_nodes)) {
                parsedNodes = [...new Set(parsedNodes.concat(data.parsed_nodes))].sort();
                $('#wb3d_parsed_nodes_input').val(JSON.stringify(parsedNodes));
            }
            if (data.glb_url) {
                $('#wb3d_glb_url').val(data.glb_url);
                parseGLBFile(data.glb_url);
            }
            if (data.base_price !== undefined) {
                $('#wb3d_base_price').val(data.base_price);
            }
            if (data.camera_orbit) {
                $('#wb3d_camera_orbit').val(data.camera_orbit);
            }
            if (data.camera_target) {
                $('#wb3d_camera_target').val(data.camera_target);
            }
            if (data.sidebar_title) {
                $('#wb3d_sidebar_title').val(data.sidebar_title);
            }
            if (data.sidebar_subtitle) {
                $('#wb3d_sidebar_subtitle').val(data.sidebar_subtitle);
            }
            var rawAttrs = data.active_attributes || data.activeAttributes;
            if (rawAttrs && Array.isArray(rawAttrs)) {
                activeAttributes = rawAttrs.map(function(item) {
                    if (typeof item === 'string') {
                        return { id: item, showWhenToggle: '', showWhenValue: '' };
                    }
                    return item;
                });
                renderActiveAttributes();
            }
            var rawToggles = data.geometry_toggles || data.geometryToggles;
            if (rawToggles && Array.isArray(rawToggles)) {
                geometryToggles = rawToggles;
                // Dodaj węzły z wariantów do listy parsedNodes, by natychmiast uzupełniły dropdowny
                geometryToggles.forEach(function(tog) {
                    if (tog.nodeActive && !parsedNodes.includes(tog.nodeActive)) parsedNodes.push(tog.nodeActive);
                    if (tog.nodeDefault && !parsedNodes.includes(tog.nodeDefault)) parsedNodes.push(tog.nodeDefault);
                    if (tog.options) {
                        tog.options.forEach(function(opt) {
                            if (opt.meshId && !parsedNodes.includes(opt.meshId)) parsedNodes.push(opt.meshId);
                        });
                    }
                });
                parsedNodes.sort();
                $('#wb3d_parsed_nodes_input').val(JSON.stringify(parsedNodes));
                renderGeometryToggles();
            }
        }

        // Obsługa Szybkiego Importu z JSON
        $('#wb3d_import_json_btn').on('click', function(e) {
            e.preventDefault();
            var jsonStr = $('#wb3d_import_json_input').val().trim();
            if (!jsonStr) {
                alert('Proszę najpierw wkleić kod JSON.');
                return;
            }
            try {
                var data = JSON.parse(jsonStr);
                loadModelConfigData(data);
                alert('Konfiguracja została wczytana do formularza! Pamiętaj, aby zapisać model na dole strony.');
            } catch (err) {
                alert('Błąd parsowania kodu JSON. Upewnij się, że wkleiłeś poprawny kod.');
                console.error(err);
            }
        });

        // Kopiowanie konfiguracji modelu do schowka (bezpośrednio)
        $('#wb3d-export-model-clipboard-btn').on('click', function() {
            saveGeometryTogglesFromDOM();
            saveActiveAttributesFromDOM();
            
            var config = {
                name: $('#model_name').val().trim(),
                glb_url: $('#wb3d_glb_url').val().trim(),
                base_price: parseFloat($('#wb3d_base_price').val()) || 0,
                camera_orbit: $('#wb3d_camera_orbit').val().trim(),
                camera_target: $('#wb3d_camera_target').val().trim(),
                sidebar_title: $('#wb3d_sidebar_title').val().trim(),
                sidebar_subtitle: $('#wb3d_sidebar_subtitle').val().trim(),
                active_attributes: activeAttributes,
                geometry_toggles: geometryToggles
            };

            var json = JSON.stringify(config, null, 2);
            navigator.clipboard.writeText(json).then(function() {
                alert('Konfiguracja modelu została skopiowana do schowka!');
                $('#wb3d_import_json_input').val(json);
            }).catch(function(err) {
                alert('Błąd kopiowania do schowka.');
                console.error(err);
            });
        });

        // Wklejanie konfiguracji modelu ze schowka (bezpośredni odczyt)
        $('#wb3d-import-model-clipboard-btn').on('click', function() {
            navigator.clipboard.readText().then(function(rawJson) {
                if (!rawJson) {
                    alert('Schowek jest pusty!');
                    return;
                }
                try {
                    var data = JSON.parse(rawJson);
                    loadModelConfigData(data);
                    $('#wb3d_import_json_input').val(rawJson);
                    alert('Konfiguracja została pomyślnie załadowana bezpośrednio ze schowka! Pamiętaj, aby kliknąć "Zapisz zmiany" na dole strony.');
                } catch (e) {
                    alert('Błąd parsowania danych ze schowka. Upewnij się, że skopiowałeś poprawną konfigurację modelu.');
                    console.error(e);
                }
            }).catch(function(err) {
                alert('Brak uprawnień do odczytu schowka. Zezwól przeglądarce na dostęp.');
                console.error(err);
            });
        });

        // Uploader GLB
        $('#wb3d_upload_glb_btn').on('click', function(e) {
            e.preventDefault();
            var file_frame = wp.media.frames.file_frame = wp.media({
                title: 'Wybierz model 3D (GLB)',
                button: { text: 'Użyj tego modelu' },
                multiple: false,
                library: { type: 'application/octet-stream' } // do plików binarnych glb
            });

            file_frame.on('select', function() {
                var attachment = file_frame.state().get('selection').first().toJSON();
                $('#wb3d_glb_url').val(attachment.url);
                // Uruchamiamy parsowanie pliku GLB
                parseGLBFile(attachment.url);
            });

            file_frame.open();
        });

        // Uploader USDZ
        $('#wb3d_upload_usdz_btn').on('click', function(e) {
            e.preventDefault();
            var file_frame = wp.media.frames.file_frame = wp.media({
                title: 'Wybierz model AR dla iOS (USDZ)',
                button: { text: 'Użyj tego modelu' },
                multiple: false
            });

            file_frame.on('select', function() {
                var attachment = file_frame.state().get('selection').first().toJSON();
                $('#wb3d_usdz_url').val(attachment.url);
            });

            file_frame.open();
        });

        // Parsowanie pliku GLB przy ręcznej zmianie pola tekstowego URL
        $('#wb3d_glb_url').on('change', function() {
            var url = $(this).val().trim();
            if (url) {
                parseGLBFile(url);
            }
        });

        // Funkcja parsująca plik GLB w tle
        function parseGLBFile(url) {
            console.log("Rozpoczęto parsowanie pliku GLB: " + url);
            console.log("Status rejestracji elementu model-viewer: " + (customElements.get('model-viewer') ? 'Zarejestrowany' : 'NIEZAREJESTROWANY!'));

            var $container = $('#wb3d-hidden-parser-container');
            $container.empty();

            // Tworzymy tymczasowy model-viewer
            var $viewer = $('<model-viewer>')
                .attr('id', 'wb3d-temp-parser')
                .attr('src', url)
                .attr('loading', 'eager') // Wymuszenie natychmiastowego ładowania w tle
                .attr('style', 'width:100%; height:100%;');

            $container.append($viewer);

            // Wyświetlenie statusu wczytywania
            $('#wb3d-add-toggle-btn').prop('disabled', true).text('Parsowanie modelu 3D w tle...');

            // Awaryjny timeout na wypadek braku reakcji (np. zablokowane połączenie lub brak rejestracji custom elementu)
            var parseTimeout = setTimeout(function() {
                console.warn("Parsowanie modelu GLB przekroczyło limit czasu (10 sekund). Odblokowywanie przycisku.");
                $('#wb3d-add-toggle-btn').prop('disabled', false).html('<span class="dashicons dashicons-plus-alt2" style="margin-top:4px;"></span> Dodaj wariant geometryczny');
            }, 10000);

            var modelViewer = document.getElementById('wb3d-temp-parser');
            
            modelViewer.addEventListener('load', function() {
                clearTimeout(parseTimeout);
                console.log("Model-viewer załadował plik GLB w tle. Rozpoczynam odczyt sceny.");
                try {
                    // Wyciąganie sceny Three.js przez Symbol
                    var sceneSym = Object.getOwnPropertySymbols(modelViewer).find(function(x) {
                        return x.description === 'scene';
                    });
                    
                    if (sceneSym && modelViewer[sceneSym]) {
                        var scene = modelViewer[sceneSym];
                        var nodesList = [];

                        scene.traverse(function(obj) {
                            if (obj.name && !obj.name.startsWith('OSG_') && obj.name.trim() !== '') {
                                nodesList.push(obj.name);
                            }
                        });

                        // Unikalne i posortowane węzły
                        parsedNodes = [...new Set(nodesList)].sort();
                        
                        // Filtrujemy by domyślnie ułatwić i pokazać tylko grupy
                        $('#wb3d_parsed_nodes_input').val(JSON.stringify(parsedNodes));
                        console.log("Model GLB sparsowany pomyślnie. Znaleziono węzłów: " + parsedNodes.length);
                        
                        // Odświeżenie widoku wariantów z nowymi dropdownami
                        renderGeometryToggles();
                    } else {
                        console.warn("Nie odnaleziono Symbol(scene) w obiekcie model-viewer.");
                        alert("Nie udało się odczytać struktury 3D. Upewnij się, że plik GLB jest prawidłowy i wtyczka model-viewer działa.");
                    }
                } catch (err) {
                    console.error("Błąd podczas parsowania sceny GLB", err);
                } finally {
                    $('#wb3d-add-toggle-btn').prop('disabled', false).html('<span class="dashicons dashicons-plus-alt2" style="margin-top:4px;"></span> Dodaj wariant geometryczny');
                    $container.empty(); // Sprzątamy
                }
            });

            modelViewer.addEventListener('error', function(err) {
                clearTimeout(parseTimeout);
                console.error("Błąd wczytywania modelu do parsera", err);
                alert("Błąd wczytywania modelu 3D do parsera. Sprawdź poprawność pliku.");
                $('#wb3d-add-toggle-btn').prop('disabled', false).html('<span class="dashicons dashicons-plus-alt2" style="margin-top:4px;"></span> Dodaj wariant geometryczny');
            });
        }

        // Generowanie HTML dla wariantów geometrycznych
        function renderGeometryToggles() {
            var $container = $('#wb3d-geometry-toggles-container');
            $container.empty();

            if (!geometryToggles.length) {
                $container.html('<p class="description italic">Brak zdefiniowanych wariantów geometrycznych. Kliknij przycisk poniżej, aby stworzyć pierwszy.</p>');
                return;
            }

            geometryToggles.forEach(function(tog, idx) {
                var bodyHtml = '';
                var dropdownOptions = getNodesDropdownOptions();

                if (tog.type === 'checkbox') {
                    if (tog.isCosmetic) {
                        bodyHtml = `
                            <div style="background: #fcfcfc; border: 1px dashed #dcdcde; padding: 10px 15px; border-radius: 4px; color: #646970; font-style: italic;">
                                <span class="dashicons dashicons-info" style="font-size:16px; width:16px; height:16px; margin-top:2px; color:#007cba; margin-right:4px;"></span> Opcja kosmetyczna (tylko cena). Brak powiązanych elementów 3D.
                            </div>
                        `;
                    } else {
                        bodyHtml = `
                            <div class="wb3d-row-flex">
                                <div>
                                    <label>Element domyślnie widoczny (Stan: NIE):</label>
                                    <select class="wb3d-toggle-node-default">
                                        <option value="">-- Nic nie ukrywaj --</option>
                                        ${generateOptionsHtml(tog.nodeDefault, dropdownOptions)}
                                    </select>
                                </div>
                                <div>
                                    <label>Element pokazywany po zaznaczeniu (Stan: TAK):</label>
                                    <select class="wb3d-toggle-node-active">
                                        <option value="">-- Wybierz element --</option>
                                        ${generateOptionsHtml(tog.nodeActive, dropdownOptions)}
                                    </select>
                                </div>
                            </div>
                        `;
                    }
                } else {
                  // Typ select (Dropdown)
                  var selectOptionsHtml = '';
                  if (tog.options && tog.options.length) {
                      tog.options.forEach(function(opt, optIdx) {
                          var meshSelectHtml = '';
                          if (!tog.isCosmetic) {
                              meshSelectHtml = `
                                  <select class="wb3d-sub-opt-mesh" style="width: 250px;">
                                      <option value="">-- Wybierz element --</option>
                                      ${generateOptionsHtml(opt.meshId, dropdownOptions)}
                                  </select>
                              `;
                          } else {
                              meshSelectHtml = `
                                  <div style="width: 250px; color:#646970; font-style:italic; font-size:11px; padding-top:4px;">(Opcja kosmetyczna)</div>
                              `;
                          }

                          selectOptionsHtml += `
                              <div class="wb3d-sub-option-row" data-sub-opt-idx="${optIdx}" style="display:flex; align-items:center; gap:10px; margin-bottom: 5px;">
                                  <input type="radio" name="default_select_${tog.id}" class="wb3d-sub-opt-default" ${opt.isDefault ? 'checked' : ''} title="Domyślna opcja">
                                  <input type="text" placeholder="Etykieta np. Kotwy stalowe" class="wb3d-sub-opt-label" value="${opt.label}" style="width: 180px;">
                                  ${meshSelectHtml}
                                  <input type="number" step="0.01" placeholder="Dopłata" class="wb3d-sub-opt-price" value="${opt.price || 0}" style="width: 80px;"> zł
                                  <button type="button" class="wb3d-remove-btn wb3d-remove-sub-opt-btn"><span class="dashicons dashicons-trash"></span></button>
                              </div>
                           `;
                      });
                  }

                  bodyHtml = `
                      <div class="wb3d-sub-options-container">
                          <label>Opcje w dropdownie (wielokrotny wybór):</label>
                          <div class="wb3d-sub-options-list">
                              ${selectOptionsHtml}
                          </div>
                          <button type="button" class="button button-small wb3d-add-sub-opt-btn" style="margin-top: 8px;">
                              <span class="dashicons dashicons-plus-alt"></span> Dodaj opcję do listy
                          </button>
                      </div>
                  `;
                }

                var dependenciesHtml = `
                    <div style="margin-top: 12px; border-top: 1px dashed #e5e5e5; padding-top: 8px; display: flex; flex-direction: column; gap: 8px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span class="dashicons dashicons-yes-alt" style="color:#00a32a; margin-top:2px;"></span>
                            <label style="font-size: 12px; color: #1d2327; font-weight: 500; min-width: 250px;">Aktywuj ten wariant TYLKO GDY włączony:</label>
                            <select class="wb3d-toggle-enable-when" style="width: 200px; font-size: 12px; height: 28px;">
                                <option value="">-- Dostępny zawsze --</option>
                                ${generateDisableWhenOptionsHtml(tog.enableWhen, idx)}
                            </select>
                            <input type="text" class="wb3d-toggle-enable-when-value" value="${tog.enableWhenValue || ''}" placeholder="Wartość (np. piaskownica)" style="width: 200px; font-size: 12px; height: 28px;" title="Dla opcji nadrzędnej typu lista wpisz jej wartość 'value' (np. piaskownica). Dla przełącznika TAK/NIE pozostaw to pole puste.">
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span class="dashicons dashicons-dismiss" style="color:#d63638; margin-top:2px;"></span>
                            <label style="font-size: 12px; color: #646970; font-weight: 500; min-width: 280px;">Dezaktywuj ten wariant, gdy inny jest włączony (TAK):</label>
                            <select class="wb3d-toggle-disable-when" style="width: 250px; font-size: 12px; height: 28px;">
                                <option value="">-- Brak blokady --</option>
                                ${generateDisableWhenOptionsHtml(tog.disableWhen, idx)}
                            </select>
                        </div>
                    </div>
                `;

                var moveControlsHtml = `
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <button type="button" class="button button-small wb3d-toggle-up-btn" style="padding:0; min-width: 22px; height: 18px; line-height: 14px;" ${idx === 0 ? 'disabled' : ''} title="Przesuń w górę">
                            <span class="dashicons dashicons-arrow-up-alt2" style="font-size: 14px; width: 14px; height: 14px; margin-top: 1px;"></span>
                        </button>
                        <button type="button" class="button button-small wb3d-toggle-down-btn" style="padding:0; min-width: 22px; height: 18px; line-height: 14px;" ${idx === geometryToggles.length - 1 ? 'disabled' : ''} title="Przesuń w dół">
                            <span class="dashicons dashicons-arrow-down-alt2" style="font-size: 14px; width: 14px; height: 14px; margin-top: 1px;"></span>
                        </button>
                    </div>
                `;

                var cardHtml = `
                    <div class="wb3d-toggle-item" data-idx="${idx}">
                        <div class="wb3d-toggle-item-title flex justify-between" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
                            <div style="display:flex; gap:10px; align-items:center;">
                                ${moveControlsHtml}
                                <input type="text" class="wb3d-toggle-name" value="${tog.name}" placeholder="Nazwa wariantu (np. Typ huśtawki)" style="width: 250px; font-weight:bold;">
                                <input type="number" class="wb3d-toggle-price" value="${tog.price || 0}" placeholder="Cena dodatkowa" style="width: 80px;" ${tog.type === 'select' ? 'disabled style="opacity:0.5;" title="Cena jest konfigurowana osobno dla każdej opcji z listy"' : ''}> zł
                            </div>
                            <div style="display:flex; gap:10px; align-items:center;">
                                <select class="wb3d-toggle-type" style="width: 150px;">
                                    <option value="checkbox" ${tog.type === 'checkbox' ? 'selected' : ''}>Przełącznik (TAK/NIE)</option>
                                    <option value="select" ${tog.type === 'select' ? 'selected' : ''}>Lista (Dropdown)</option>
                                </select>
                                <label style="font-size: 12px; color: #1d2327; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; user-select: none; background: #f0f6fa; border:1px solid #c3c4c7; padding: 2px 8px; border-radius: 3px;">
                                    <input type="checkbox" class="wb3d-toggle-is-cosmetic" ${tog.isCosmetic ? 'checked' : ''} style="margin: 0;"> Opcja kosmetyczna (tylko cena)
                                </label>
                                <button type="button" class="wb3d-remove-btn wb3d-remove-toggle-btn">
                                    <span class="dashicons dashicons-trash"></span> Usuń wariant
                                </button>
                            </div>
                        </div>
                        ${bodyHtml}
                        ${dependenciesHtml}
                    </div>
                `;
                $container.append(cardHtml);
            });
            renderActiveAttributes();
        }

        // Generowanie opcji zależności
        function generateDisableWhenOptionsHtml(selectedValue, currentIdx) {
            var html = '';
            geometryToggles.forEach(function(otherTog, idx) {
                if (idx !== currentIdx && otherTog.name && otherTog.name.trim() !== '') {
                    var selected = otherTog.name === selectedValue ? 'selected' : '';
                    html += `<option value="${otherTog.name}" ${selected}>${otherTog.name}</option>`;
                }
            });
            return html;
        }

        // Pobranie listy węzłów do opcji dropdowna
        function getNodesDropdownOptions() {
            var options = [];
            parsedNodes.forEach(function(node) {
                options.push({ value: node, label: node });
            });
            return options;
        }

        // Funkcja pomocnicza generująca opcje wyboru w dropdownie z zaznaczonym elementem
        function generateOptionsHtml(selectedValue, optionsList) {
            var html = '';
            var found = false;
            optionsList.forEach(function(opt) {
                var selected = opt.value === selectedValue ? 'selected' : '';
                if (selected) found = true;
                html += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
            });
            // Jeśli węzeł został podany w konfiguracji, ale nie ma go jeszcze w opcjach, dodajemy go jako zaznaczony
            if (selectedValue && !found) {
                html += `<option value="${selectedValue}" selected>${selectedValue}</option>`;
            }
            return html;
        }

        // Zapisywanie danych wpisanych w formularzu wariantów geometrycznych do pamięci
        function saveGeometryTogglesFromDOM() {
            var updated = [];
            $('.wb3d-toggle-item').each(function() {
                var $item = $(this);
                var idx = $item.data('idx');
                if (geometryToggles[idx] === undefined) return;
                
                var type = $item.find('.wb3d-toggle-type').val();
                var isCosmetic = $item.find('.wb3d-toggle-is-cosmetic').is(':checked');
                var tog = {
                    id: geometryToggles[idx].id || Date.now() + idx,
                    name: $item.find('.wb3d-toggle-name').val().trim(),
                    type: type,
                    isCosmetic: isCosmetic,
                    price: parseFloat($item.find('.wb3d-toggle-price').val()) || 0,
                    enableWhen: $item.find('.wb3d-toggle-enable-when').val() || '',
                    enableWhenValue: $item.find('.wb3d-toggle-enable-when-value').val() ? $item.find('.wb3d-toggle-enable-when-value').val().trim() : (geometryToggles[idx] ? (geometryToggles[idx].enableWhenValue || '') : ''),
                    disableWhen: $item.find('.wb3d-toggle-disable-when').val() || ''
                };

                if (type === 'checkbox') {
                    tog.nodeDefault = isCosmetic ? '' : ($item.find('.wb3d-toggle-node-default').val() || '');
                    tog.nodeActive = isCosmetic ? '' : ($item.find('.wb3d-toggle-node-active').val() || '');
                } else {
                    tog.options = [];
                    $item.find('.wb3d-sub-option-row').each(function() {
                        var $subRow = $(this);
                        tog.options.push({
                            label: $subRow.find('.wb3d-sub-opt-label').val().trim(),
                            value: $subRow.find('.wb3d-sub-opt-label').val().trim().toLowerCase().replace(/[^a-z0-9]/g, '-'),
                            meshId: isCosmetic ? '' : ($subRow.find('.wb3d-sub-opt-mesh').val() || ''),
                            price: parseFloat($subRow.find('.wb3d-sub-opt-price').val()) || 0,
                            isDefault: $subRow.find('.wb3d-sub-opt-default').is(':checked')
                        });
                    });
                }
                updated.push(tog);
            });
            geometryToggles = updated;
        }

        // Dodawanie wariantu geometrycznego
        $('#wb3d-add-toggle-btn').on('click', function() {
            saveGeometryTogglesFromDOM();
            geometryToggles.push({
                id: Date.now(),
                name: 'Nowy wariant geometryczny',
                type: 'checkbox',
                isCosmetic: false,
                price: 0,
                enableWhen: '',
                enableWhenValue: '',
                disableWhen: '',
                nodeDefault: '',
                nodeActive: ''
            });
            renderGeometryToggles();
        });

        // Usuwanie wariantu
        $(document).on('click', '.wb3d-remove-toggle-btn', function() {
            saveGeometryTogglesFromDOM();
            var idx = $(this).closest('.wb3d-toggle-item').data('idx');
            geometryToggles.splice(idx, 1);
            renderGeometryToggles();
        });

        // Zmiana kolejności: Przesuwanie w górę
        $(document).on('click', '.wb3d-toggle-up-btn', function() {
            saveGeometryTogglesFromDOM();
            var idx = $(this).closest('.wb3d-toggle-item').data('idx');
            if (idx > 0) {
                var temp = geometryToggles[idx];
                geometryToggles[idx] = geometryToggles[idx - 1];
                geometryToggles[idx - 1] = temp;
                renderGeometryToggles();
            }
        });

        // Zmiana kolejności: Przesuwanie w dół
        $(document).on('click', '.wb3d-toggle-down-btn', function() {
            saveGeometryTogglesFromDOM();
            var idx = $(this).closest('.wb3d-toggle-item').data('idx');
            if (idx < geometryToggles.length - 1) {
                var temp = geometryToggles[idx];
                geometryToggles[idx] = geometryToggles[idx + 1];
                geometryToggles[idx + 1] = temp;
                renderGeometryToggles();
            }
        });

        // Zmiana typu kontrolki geometrycznej
        $(document).on('change', '.wb3d-toggle-type', function() {
            saveGeometryTogglesFromDOM();
            var idx = $(this).closest('.wb3d-toggle-item').data('idx');
            geometryToggles[idx].type = $(this).val();
            if (geometryToggles[idx].type === 'select') {
                geometryToggles[idx].options = [];
            } else {
                geometryToggles[idx].nodeDefault = '';
                geometryToggles[idx].nodeActive = '';
            }
            renderGeometryToggles();
        });

        // Zmiana stanu opcji kosmetycznej
        $(document).on('change', '.wb3d-toggle-is-cosmetic', function() {
            saveGeometryTogglesFromDOM();
            renderGeometryToggles();
        });

        // Dodawanie pod-opcji do listy rozwijanej (select)
        $(document).on('click', '.wb3d-add-sub-opt-btn', function() {
            saveGeometryTogglesFromDOM();
            var idx = $(this).closest('.wb3d-toggle-item').data('idx');
            if (!geometryToggles[idx].options) {
                geometryToggles[idx].options = [];
            }
            geometryToggles[idx].options.push({
                label: 'Opcja dropdowna',
                value: 'opcja-' + Date.now(),
                meshId: '',
                price: 0,
                isDefault: false
            });
            renderGeometryToggles();
        });

        // Usuwanie pod-opcji
        $(document).on('click', '.wb3d-remove-sub-opt-btn', function() {
            saveGeometryTogglesFromDOM();
            var idx = $(this).closest('.wb3d-toggle-item').data('idx');
            var subIdx = $(this).closest('.wb3d-sub-option-row').data('sub-opt-idx');
            geometryToggles[idx].options.splice(subIdx, 1);
            renderGeometryToggles();
        });

        // renderActiveAttributes: Renderowanie listy cech kolorystycznych z zależnościami
        function renderActiveAttributes() {
            var $container = $('#wb3d-active-attributes-container');
            if (!$container.length) return;
            $container.empty();

            if (!window.wb3dGlobalAttrsList || !window.wb3dGlobalAttrsList.length) {
                $container.html('<p class="description" style="color: #cf2e2e;">Brak zdefiniowanych atrybutów globalnych. Przejdź do zakładki <strong>Cechy Globalne</strong> na górze, aby je dodać.</p>');
                return;
            }

            window.wb3dGlobalAttrsList.forEach(function(globalAttr) {
                var activeConfig = activeAttributes.find(a => a.id === globalAttr.id);
                var isChecked = activeConfig !== undefined;
                
                var showWhenToggle = activeConfig ? (activeConfig.showWhenToggle || '') : '';
                var showWhenValue = activeConfig ? (activeConfig.showWhenValue || '') : '';

                var toggleOptionsHtml = '<option value="">-- Pokazuj zawsze --</option>';
                geometryToggles.forEach(function(tog) {
                    if (tog.name && tog.name.trim() !== '') {
                        var selected = tog.name === showWhenToggle ? 'selected' : '';
                        toggleOptionsHtml += `<option value="${tog.name}" ${selected}>${tog.name}</option>`;
                    }
                });

                var valueFieldHtml = '';
                if (showWhenToggle) {
                    var selectedTog = geometryToggles.find(t => t.name === showWhenToggle);
                    if (selectedTog) {
                        valueFieldHtml = `<select class="wb3d-active-attr-val" style="width: 200px; font-size:12px; height:28px;">`;
                        valueFieldHtml += `<option value="">-- Wybierz wartość --</option>`;
                        if (selectedTog.type === 'checkbox') {
                            var selTrue = showWhenValue === 'true' ? 'selected' : '';
                            var selFalse = showWhenValue === 'false' ? 'selected' : '';
                            valueFieldHtml += `<option value="true" ${selTrue}>TAK</option>`;
                            valueFieldHtml += `<option value="false" ${selFalse}>NIE</option>`;
                        } else if (selectedTog.type === 'select' && selectedTog.options) {
                            selectedTog.options.forEach(function(opt) {
                                var selected = opt.value === showWhenValue ? 'selected' : '';
                                valueFieldHtml += `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
                            });
                        }
                        valueFieldHtml += `</select>`;
                    }
                }
                
                if (!valueFieldHtml) {
                    valueFieldHtml = `<input type="text" class="wb3d-active-attr-val" placeholder="Wartość (np. true)" value="${showWhenValue}" style="width: 200px; font-size:12px; height:28px;" ${showWhenToggle ? '' : 'disabled'}>`;
                }

                var rowHtml = `
                    <div class="wb3d-active-attr-row" data-attr-id="${globalAttr.id}" style="display: flex; align-items: center; justify-content: space-between; padding: 10px; border: 1px solid #e5e5e5; background: #fff; margin-bottom: 8px; border-radius: 4px;">
                        <div style="display: flex; align-items: center; gap: 10px; width: 350px;">
                            <input type="checkbox" class="wb3d-active-attr-checkbox" ${isChecked ? 'checked' : ''}>
                            <div>
                                <strong style="font-size:13px; color:#1d2327;">${globalAttr.name}</strong>
                                <div style="font-size:11px; color:#646970; font-family: monospace;">ID: ${globalAttr.id}</div>
                            </div>
                        </div>
                        
                        <div class="wb3d-active-attr-dependency" style="display: flex; align-items: center; gap: 8px; flex-grow: 1; justify-content: flex-end; ${isChecked ? '' : 'opacity: 0.5; pointer-events: none;'}">
                            <span class="dashicons dashicons-filter" style="color: #646970; font-size: 18px; margin-top:2px;"></span>
                            <label style="font-size: 12px; color: #646970;">Pokazuj tylko gdy wariant:</label>
                            <select class="wb3d-active-attr-toggle" style="width: 200px; font-size: 12px; height: 28px;">
                                ${toggleOptionsHtml}
                            </select>
                            <label style="font-size: 12px; color: #646970;">ma wartość:</label>
                            ${valueFieldHtml}
                        </div>
                    </div>
                `;
                $container.append(rowHtml);
            });
        }

        // Zapisywanie stanu aktywnych cech z DOM do pamięci activeAttributes
        function saveActiveAttributesFromDOM() {
            var updated = [];
            $('.wb3d-active-attr-row').each(function() {
                var $row = $(this);
                var isChecked = $row.find('.wb3d-active-attr-checkbox').is(':checked');
                if (isChecked) {
                    var id = $row.data('attr-id');
                    var toggle = $row.find('.wb3d-active-attr-toggle').val() || '';
                    var val = $row.find('.wb3d-active-attr-val').val() || '';
                    updated.push({
                        id: id,
                        showWhenToggle: toggle,
                        showWhenValue: val
                    });
                }
            });
            activeAttributes = updated;
        }

        // Obsługa interakcji w cechach kolorystycznych
        $(document).on('change', '.wb3d-active-attr-checkbox', function() {
            saveActiveAttributesFromDOM();
            renderActiveAttributes();
        });

        $(document).on('change', '.wb3d-active-attr-toggle', function() {
            saveActiveAttributesFromDOM();
            // Resetujemy wartość, gdy zmienia się powiązany wariant
            var $row = $(this).closest('.wb3d-active-attr-row');
            var attrId = $row.data('attr-id');
            var activeConfig = activeAttributes.find(a => a.id === attrId);
            if (activeConfig) {
                activeConfig.showWhenValue = '';
            }
            renderActiveAttributes();
        });

        $(document).on('change input', '.wb3d-active-attr-val', function() {
            saveActiveAttributesFromDOM();
        });

        // Serializacja i zapisanie pól przed wysłaniem formularza produktu/strony
        $('form#wb3d-model-form').on('submit', function() {
            saveGeometryTogglesFromDOM();
            var output = geometryToggles.filter(function(tog) {
                return tog.name;
            });
            $('#wb3d_geometry_toggles_input').val(JSON.stringify(output));

            saveActiveAttributesFromDOM();
            $('#wb3d_active_attributes_json').val(JSON.stringify(activeAttributes));
        });

        // Inicjalne renderowanie metaboxa
        renderGeometryToggles();
        renderActiveAttributes();

        // Jeśli plik GLB jest już wpisany (np. przy edycji istniejącego modelu), automatycznie uruchamiamy parsowanie w tle
        var initialGlbUrl = $('#wb3d_glb_url').val();
        if (initialGlbUrl && initialGlbUrl.trim() !== '') {
            parseGLBFile(initialGlbUrl.trim());
        }
    }
});
