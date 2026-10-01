jQuery(document).ready(function($) {

    // Inicjalizacja każdego kontenera konfiguratora na stronie
    $('.wb3d-configurator-container').each(function() {
        var $container = $(this);
        var configData = {};
        var $configScript = $container.find('.wb3d-config-json');
        if ($configScript.length) {
            try {
                configData = JSON.parse($configScript.html());
            } catch (err) {
                console.error("Błąd parsowania JSON konfiguracji", err);
            }
        } else {
            configData = $container.data('config') || {};
        }
        var $viewer = $container.find('.wb3d-viewer');
        
        if (!$viewer.length) {
            return;
        }

        var viewer = $viewer[0];
        var glbScene = null;
        var isSandboxClosed = false;
        var sandboxAnimCounter = 0;
        var prevZamykanaPiaskownicaActive = false;
        
        // Stan lokalny dla tej instancji konfiguratora
        var clientState = {
            attributes: {}, // ID atrybutu -> wartość (Hex lub URL tekstury)
            toggles: {},    // ID togli geometrycznych -> wartość (true/false lub wybrany select value)
            isMirrored: false
        };

        // Inicjalizacja stanów domyślnych z danych przekazanych w data-attribute
        function initializeConfiguratorState() {
            // Wpisanie ceny bazowej w HTML
            $container.find('.wb3d-base-price-display').text(formatPrice(configData.basePrice) + ' zł');
            
            // 1. Stany domyślne dla atrybutów kolorystycznych
            if (configData.activeAttributes && configData.activeAttributes.length) {
                configData.activeAttributes.forEach(function(attr) {
                    if (attr.options && attr.options.length) {
                        var defaultOpt = attr.options.find(o => o.isDefault) || attr.options[0];
                        clientState.attributes[attr.id] = defaultOpt.value;
                    }
                });
            }

            // 2. Stany domyślne dla wariantów geometrycznych
            if (configData.geometryToggles && configData.geometryToggles.length) {
                configData.geometryToggles.forEach(function(tog) {
                    if (tog.type === 'checkbox') {
                        clientState.toggles[tog.name] = false;
                    } else if (tog.type === 'select') {
                        var defaultOpt = tog.options.find(o => o.isDefault) || tog.options[0];
                        clientState.toggles[tog.name] = defaultOpt.value;
                    }
                });
            }
        }

        // Renderowanie elementów interfejsu (Swatchy i Togli) wewnątrz kontenera
        function renderConfiguratorUI() {
            // 1. Renderowanie swatchy kolorystycznych
            var $materialsContainer = $container.find('.wb3d-materials-container');
            $materialsContainer.empty();

            if (configData.activeAttributes && configData.activeAttributes.length) {
                configData.activeAttributes.forEach(function(attr) {
                    var swatchHtml = '';
                    
                    attr.options.forEach(function(opt) {
                        var activeClass = clientState.attributes[attr.id] === opt.value ? 'wb3d-active' : '';
                        var styleHtml = '';

                        if (attr.type === 'color') {
                            styleHtml = `background-color: ${opt.value};`;
                        } else {
                            styleHtml = `background-image: url(${opt.thumbnailUrl || opt.value}); background-size: cover;`;
                        }

                        swatchHtml += `
                            <div class="wb3d-swatch-wrapper" data-tooltip="${opt.name}">
                                <button type="button" 
                                        class="wb3d-swatch-btn ${activeClass}" 
                                        style="${styleHtml}" 
                                        data-attr-id="${attr.id}"
                                        data-opt-val="${opt.value}">
                                </button>
                            </div>
                        `;
                    });

                    var sectionHtml = `
                        <div class="wb3d-ui-section" data-attr-id="${attr.id}">
                            <h4>${attr.name}</h4>
                            <div class="wb3d-swatches-grid">
                                ${swatchHtml}
                            </div>
                        </div>
                    `;
                    $materialsContainer.append(sectionHtml);
                });
            }

            // 2. Renderowanie opcji geometrycznych (Toggles)
            var $geometryContainer = $container.find('.wb3d-geometry-container');
            $geometryContainer.empty();

            if (configData.geometryToggles && configData.geometryToggles.length) {
                configData.geometryToggles.forEach(function(tog) {
                    var controlHtml = '';

                    if (tog.type === 'checkbox') {
                        var isChecked = clientState.toggles[tog.name] === true;
                        var priceText = formatPrice(tog.price);
                        var optionHtml = `
                            <option value="false" ${!isChecked ? 'selected' : ''}>Nie</option>
                            <option value="true" ${isChecked ? 'selected' : ''}>Tak${tog.price > 0 ? ' (+' + priceText + ' zł)' : ''}</option>
                        `;

                        controlHtml = `
                            <div class="wb3d-select-group">
                                <div class="wb3d-select-label-row">
                                    <strong>${tog.name}:</strong>
                                    <span class="wb3d-toggle-price-text">${isChecked && tog.price > 0 ? '+' + priceText + ' zł' : ''}</span>
                                </div>
                                <select class="wb3d-geo-checkbox-select wb3d-geo-select" data-tog-name="${tog.name}">
                                    ${optionHtml}
                                </select>
                            </div>
                        `;
                    } else if (tog.type === 'select') {
                        var selectedVal = clientState.toggles[tog.name];
                        var selectOptions = '';
                        var selectedOpt = tog.options.find(o => o.value === selectedVal) || tog.options[0];
                        var activePrice = selectedOpt && selectedOpt.price > 0 ? selectedOpt.price : 0;
                        
                        tog.options.forEach(function(opt) {
                            var priceSuffix = opt.price > 0 ? ` (+${formatPrice(opt.price)} zł)` : '';
                            selectOptions += `<option value="${opt.value}" ${opt.value === selectedVal ? 'selected' : ''}>${opt.label}${priceSuffix}</option>`;
                        });

                        controlHtml = `
                            <div class="wb3d-select-group">
                                <div class="wb3d-select-label-row">
                                    <strong>${tog.name}:</strong>
                                    <span class="wb3d-toggle-price-text">${activePrice > 0 ? '+' + formatPrice(activePrice) + ' zł' : ''}</span>
                                </div>
                                <select class="wb3d-geo-select wb3d-geo-dropdown-select" data-tog-name="${tog.name}">
                                    ${selectOptions}
                                </select>
                            </div>
                        `;
                    }

                    var sectionHtml = `
                        <div class="wb3d-ui-section-geo" data-tog-name="${tog.name}">
                            ${controlHtml}
                        </div>
                    `;
                    $geometryContainer.append(sectionHtml);
                });
            } else {
                $geometryContainer.html('<p class="wb3d-no-extras-info">Brak dodatkowych wariantów geometrycznych dla tego modelu.</p>');
            }
        }

        // Obsługa kliknięcia w swatch kolorystyczny
        $container.on('click', '.wb3d-swatch-btn', function() {
            var $btn = $(this);
            var attrId = $btn.data('attr-id');
            var optVal = $btn.data('opt-val');

            var $grid = $btn.closest('.wb3d-swatches-grid');
            $grid.find('.wb3d-swatch-btn').removeClass('wb3d-active');
            $btn.addClass('wb3d-active');

            clientState.attributes[attrId] = optVal;

            var attrConfig = configData.activeAttributes.find(a => a.id === attrId);
            if (attrConfig) {
                applyMaterialCustomization(attrConfig.id, attrConfig.type, optVal);
            }
        });

        // Obsługa zmiany przełącznika geometrycznego (typu checkbox/toggle-switch)
        $container.on('change', '.wb3d-geo-checkbox-input', function() {
            var $input = $(this);
            var togName = $input.data('tog-name');
            var val = $input.is(':checked');
            clientState.toggles[togName] = val;
            
            applyAllGeometryStates();
            calculateTotalPrice();
        });

        // Obsługa zmiany dropdowna geometrycznego (typu checkbox/bool - fallback)
        $container.on('change', '.wb3d-geo-checkbox-select', function() {
            var $select = $(this);
            var togName = $select.data('tog-name');
            var val = $select.val() === 'true';
            clientState.toggles[togName] = val;
            
            var tog = configData.geometryToggles.find(t => t.name === togName);
            var $priceSpan = $select.closest('.wb3d-select-group').find('.wb3d-toggle-price-text');
            if (val && tog && tog.price > 0) {
                $priceSpan.text('+' + formatPrice(tog.price) + ' zł');
            } else {
                $priceSpan.text('');
            }
            
            applyAllGeometryStates();
            calculateTotalPrice();
        });

        // Obsługa zmiany dropdowna geometrycznego (typu select/lista)
        $container.on('change', '.wb3d-geo-dropdown-select', function() {
            var $select = $(this);
            var togName = $select.data('tog-name');
            var val = $select.val();
            clientState.toggles[togName] = val;
            
            var tog = configData.geometryToggles.find(t => t.name === togName);
            var $priceSpan = $select.closest('.wb3d-select-group').find('.wb3d-toggle-price-text');
            if (tog && tog.options) {
                var selectedOpt = tog.options.find(o => o.value === val);
                if (selectedOpt && selectedOpt.price > 0) {
                    $priceSpan.text('+' + formatPrice(selectedOpt.price) + ' zł');
                } else {
                    $priceSpan.text('');
                }
            }
            
            applyAllGeometryStates();
            calculateTotalPrice();
        });

        // APLIKOWANIE KOLORÓW I TEKSTUR DO MODELU 3D
        async function applyMaterialCustomization(materialId, type, value) {
            if (!viewer || !viewer.model || !viewer.model.materials) return;

            if (type === 'texture') {
                try {
                    // Specjalna inteligentna obsługa wybarwienia drewna (drewno-konstrukcja, drewno-akcent, drewno-akcent2)
                    if (materialId === 'drewno-konstrukcja' || materialId === 'drewno-akcent') {
                        var mainVal = clientState.attributes['drewno-konstrukcja'] || '';
                        var accentVal = clientState.attributes['drewno-akcent'] || '';

                        // Sprawdzenie wyjątku biznesowego: Konstrukcja = Antracyt (r09) + Akcent = Biały (r01)
                        var isAntracytAndWhite = (mainVal.indexOf('r09') !== -1 && accentVal.indexOf('r01') !== -1);

                        var mainTex = mainVal ? await viewer.createTexture(mainVal) : null;
                        var accentTex = accentVal ? await viewer.createTexture(accentVal) : null;

                        for (var material of viewer.model.materials) {
                            var matName = material.name.toLowerCase();

                            if (matName.includes('drewno-konstrukcja') && mainTex) {
                                if (material.pbrMetallicRoughness && material.pbrMetallicRoughness.baseColorTexture) {
                                    material.pbrMetallicRoughness.baseColorTexture.setTexture(mainTex);
                                }
                            } else if (matName.includes('drewno-akcent2') && accentTex) {
                                // drewno-akcent2 (barierki, zastrzały, deska łącząca nogi) -> zawsze kolor akcentu (w tym Biały przy Antracyt+Biały)
                                if (material.pbrMetallicRoughness && material.pbrMetallicRoughness.baseColorTexture) {
                                    material.pbrMetallicRoughness.baseColorTexture.setTexture(accentTex);
                                }
                            } else if (matName.includes('drewno-akcent')) {
                                // drewno-akcent (dach i reszta) -> przy Antracyt+Biały zostaje antracytowy (mainTex), a normalnie kolor akcentu
                                var texToApply = isAntracytAndWhite ? mainTex : accentTex;
                                if (texToApply && material.pbrMetallicRoughness && material.pbrMetallicRoughness.baseColorTexture) {
                                    material.pbrMetallicRoughness.baseColorTexture.setTexture(texToApply);
                                }
                            }
                        }
                        return;
                    }

                    var texture = await viewer.createTexture(value);
                    for (var material of viewer.model.materials) {
                        var matName = material.name.toLowerCase();
                        if (matName.includes(materialId.toLowerCase())) {
                            if (material.pbrMetallicRoughness && material.pbrMetallicRoughness.baseColorTexture) {
                                material.pbrMetallicRoughness.baseColorTexture.setTexture(texture);
                            }
                        }
                    }
                } catch (err) {
                    console.error("Failed to apply texture to material: " + materialId, err);
                }
            } else {
                var rgb = hexToRgb(value);
                for (var material of viewer.model.materials) {
                    var matName = material.name.toLowerCase();
                    if (matName.includes(materialId.toLowerCase())) {
                        if (material.pbrMetallicRoughness) {
                            material.pbrMetallicRoughness.setBaseColorFactor(rgb);
                        }
                    }
                }
            }
        }

        // STATE-DRIVEN GEOMETRY UPDATES
        function applyAllGeometryStates() {
            if (!glbScene) return;

            // 1. Zbierz informacje o tym, które warianty są aktualnie włączone (TAK)
            var activeStates = {};
            configData.geometryToggles.forEach(function(tog) {
                var name = (tog.name || '').trim();
                var val = tog.type === 'checkbox' ? (clientState.toggles[tog.name] === true || clientState.toggles[name] === true) : (clientState.toggles[tog.name] !== undefined ? clientState.toggles[tog.name] : clientState.toggles[name]);
                activeStates[tog.name] = val;
                activeStates[name] = val;
            });

            // 2. Określ, które warianty powinny być zablokowane ze względu na zależności (disableWhen / enableWhen)
            var disabledToggles = {};

            configData.geometryToggles.forEach(function(tog) {
                var isDisabled = false;
                if (tog.disableWhen) {
                    var dw = tog.disableWhen.trim();
                    isDisabled = activeStates[tog.disableWhen] === true || activeStates[dw] === true;
                }
                if (tog.enableWhen) {
                    var ew = tog.enableWhen.trim();
                    var parentTog = configData.geometryToggles.find(function(t) {
                        return (t.name || '').trim() === ew || t.name === tog.enableWhen;
                    });
                    var parentVal = activeStates[tog.enableWhen] !== undefined ? activeStates[tog.enableWhen] : activeStates[ew];
                    if (tog.enableWhenValue !== undefined && tog.enableWhenValue !== "") {
                        var targetVal = (tog.enableWhenValue || '').toLowerCase().trim();
                        var parentValStr = (parentVal || '').toString().toLowerCase().trim();
                        var parentOpt = parentTog && parentTog.options ? parentTog.options.find(function(o) {
                            return (o.value || '').toLowerCase() === parentValStr;
                        }) : null;
                        var parentLabelStr = parentOpt ? (parentOpt.label || '').toLowerCase().trim() : '';

                        var isMatch = false;
                        if (parentValStr === targetVal) {
                            isMatch = true;
                        } else if (targetVal === 'piaskownica' || targetVal.indexOf('zamykane') !== -1) {
                            isMatch = parentValStr === 'piaskownica' || 
                                      parentValStr.indexOf('zamykane') !== -1 || 
                                      parentLabelStr.indexOf('zamykane') !== -1;
                        } else if (targetVal) {
                            isMatch = parentValStr.indexOf(targetVal) !== -1;
                        }
                        isDisabled = !isMatch;
                    } else {
                        isDisabled = activeStates[tog.enableWhen] !== true && activeStates[ew] !== true;
                    }
                }
                if (isDisabled) {
                    disabledToggles[tog.name] = true;
                    disabledToggles[(tog.name || '').trim()] = true;
                }
            });

            // 3. Aplikuj stany widoczności 3D oraz włącz/wyłącz kontrolki w HTML
            configData.geometryToggles.forEach(function(tog) {
                var isDisabled = disabledToggles[tog.name] === true || disabledToggles[(tog.name || '').trim()] === true;
                
                // Ustawienie blokady w HTML
                var $geoSection = $container.find('.wb3d-ui-section-geo').filter(function() {
                    return $(this).attr('data-tog-name') === tog.name || $(this).attr('data-tog-name') === (tog.name || '').trim();
                });
                if (!$geoSection.length) {
                    $geoSection = $container.find('.wb3d-geo-select').filter(function() {
                        return $(this).attr('data-tog-name') === tog.name || $(this).attr('data-tog-name') === (tog.name || '').trim();
                    }).closest('.wb3d-ui-section-geo');
                }

                $geoSection.find('.wb3d-geo-select, input[type="checkbox"]').prop('disabled', isDisabled);
                if (tog.enableWhen) {
                    $geoSection.toggle(!isDisabled);
                } else {
                    $geoSection.css({
                        'opacity': isDisabled ? '0.45' : '1',
                        'pointer-events': isDisabled ? 'none' : 'auto'
                    });
                }

                if (tog.type === 'checkbox') {
                    var isChecked = clientState.toggles[tog.name] === true;
                    $geoSection.find('.wb3d-geo-checkbox-input').prop('checked', isChecked);
                    $geoSection.find('.wb3d-geo-checkbox-select').val(isChecked ? 'true' : 'false');
                    
                    if (isDisabled) {
                        // Jeśli zablokowany, ukrywamy oba elementy 3D
                        if (tog.nodeActive) setNodeVisibilityDirect(tog.nodeActive, false);
                        if (tog.nodeDefault) setNodeVisibilityDirect(tog.nodeDefault, false);
                    } else {
                        // Standardowa logika widoczności dla checkboxa
                        if (tog.nodeActive) setNodeVisibilityDirect(tog.nodeActive, isChecked);
                        if (tog.nodeDefault) setNodeVisibilityDirect(tog.nodeDefault, !isChecked);
                    }
                } else if (tog.type === 'select') {
                    var selectedValue = clientState.toggles[tog.name];
                    
                    tog.options.forEach(function(opt) {
                        if (opt.meshId) {
                            if (isDisabled) {
                                // Jeśli cały wariant jest wyłączony, ukrywamy wszystkie jego meshe
                                setNodeVisibilityDirect(opt.meshId, false);
                            } else {
                                // Pokazujemy tylko wybrany wariant z listy
                                setNodeVisibilityDirect(opt.meshId, opt.value === selectedValue);
                            }
                        }
                    });
                }
            });

            // Uniwersalna reguła wykluczania elementów (np. piaskownica-bok vs podest oraz tagi _HIDE_WHEN_)
            var activeKeys = [];
            configData.geometryToggles.forEach(function(tog) {
                if (disabledToggles[tog.name]) return;
                if (tog.type === 'select') {
                    var selVal = clientState.toggles[tog.name];
                    var opt = tog.options ? tog.options.find(function(o) { return o.value === selVal; }) : null;
                    if (opt && opt.meshId) activeKeys.push(opt.meshId.toLowerCase());
                    if (selVal) activeKeys.push(selVal.toLowerCase());
                } else if (tog.type === 'checkbox') {
                    if (clientState.toggles[tog.name] === true) {
                        if (tog.nodeActive) activeKeys.push(tog.nodeActive.toLowerCase());
                        activeKeys.push(tog.name.toLowerCase());
                    }
                }
            });

            var isPodestActive = activeKeys.some(function(k) { return k.includes('podest'); });
            var isV2Active = activeKeys.some(function(k) { 
                return k.includes('trigger_v2') || k.includes('v2_trigger') || k.includes('v2-trigger') || k.includes('kamienie-ekstra'); 
            });

            // Sprawdzamy stan opcjonalnego włącznika poręczy
            var poreczToggle = configData.geometryToggles.find(function(t) { 
                var n = (t.name || '').toLowerCase();
                var m = (t.nodeActive || '').toLowerCase();
                return n.includes('poręcz') || n.includes('porecz') || n.includes('balustrad') || m.includes('balustrad'); 
            });
            var isPoreczToggled = poreczToggle ? activeStates[poreczToggle.name] : undefined;
            var showPorecz = poreczToggle ? (isPoreczToggled === true) : true;

            if (glbScene) {
                glbScene.traverse(function(obj) {
                    if (!obj.name) return;
                    var nameLower = obj.name.toLowerCase();

                    // Reguła 1: Każdy element zawierający "piaskownica-bok" znika, gdy aktywny jest podest
                    if (nameLower.includes('piaskownica-bok')) {
                        obj.visible = !isPodestActive;
                    }

                    // Reguła 2: Warianty -default vs -v2 (wyzwalane przez tag -v2-trigger / _TRIGGER_V2 lub kamienie-ekstra)
                    var isDefaultVariant = nameLower.includes('-default') || nameLower.includes('_default');
                    var isV2Variant = (nameLower.includes('-v2') || nameLower.includes('_v2')) && !nameLower.includes('trigger');

                    if (isDefaultVariant || isV2Variant) {
                        var shouldShow = isDefaultVariant ? !isV2Active : isV2Active;
                        // Tylko poręcz (opcjonalna) zależy od przełącznika w menu; poręcz schodów (porecz-default / porecz-v2) i inne elementy są zawsze widoczne
                        if (nameLower.includes('balustrada') || (nameLower.includes('porecz') && !nameLower.includes('porecz-default') && !nameLower.includes('porecz-v2'))) {
                            obj.visible = shouldShow && showPorecz;
                        } else {
                            obj.visible = shouldShow;
                        }
                    }

                    // Reguła 3: Uniwersalny tag Blendera _HIDE_WHEN_[fraza]
                    if (nameLower.includes('_hide_when_')) {
                        var parts = nameLower.split('_hide_when_');
                        var triggerWord = parts[1].split('_')[0].split('.')[0].toLowerCase();
                        var shouldHide = activeKeys.some(function(k) { return k.includes(triggerWord); });
                        obj.visible = !shouldHide;
                    }
                });
            }

            // Obsługa pływającego przełącznika animowanej piaskownicy
            var hasAnimSandbox = false;
            if (glbScene) {
                glbScene.traverse(function(obj) {
                    if (obj.name && (obj.name.toLowerCase().includes('piaskownica-animacja') || obj.name.toLowerCase().includes('animacja'))) {
                        hasAnimSandbox = true;
                    }
                });
            }
            if (!hasAnimSandbox && viewer && viewer.availableAnimations && viewer.availableAnimations.length > 0) {
                hasAnimSandbox = true;
            }

            var isZamykanaPiaskownicaActive = false;
            if (configData.geometryToggles && configData.geometryToggles.length) {
                configData.geometryToggles.forEach(function(tog) {
                    if (disabledToggles[tog.name] || disabledToggles[(tog.name || '').trim()]) return;
                    var selVal = clientState.toggles[tog.name] !== undefined ? clientState.toggles[tog.name] : clientState.toggles[(tog.name || '').trim()];

                    if (tog.type === 'select' && tog.options) {
                        var opt = tog.options.find(function(o) { return o.value === selVal; });
                        if (opt) {
                            var mesh = (opt.meshId || '').toLowerCase();
                            var label = (opt.label || '').toLowerCase();
                            var val = (opt.value || '').toLowerCase();

                            if (mesh.includes('piaskownica-animacja') || mesh.includes('animacja')) {
                                isZamykanaPiaskownicaActive = true;
                            } else if ((label.includes('zamykane') || label.includes('zamykana') || val.includes('zamykane')) &&
                                       !label.includes('otwarta') && !label.includes('otwarte') && !val.includes('otwarta')) {
                                isZamykanaPiaskownicaActive = true;
                            }
                        }
                    } else if (tog.type === 'checkbox') {
                        if (selVal === true) {
                            var node = (tog.nodeActive || '').toLowerCase();
                            var togName = (tog.name || '').toLowerCase();
                            if (node.includes('animacja') || togName.includes('zamykana') || togName.includes('zamykane')) {
                                isZamykanaPiaskownicaActive = true;
                            }
                        }
                    }
                });
            }

            var $animToggle = $container.find('#wb3d-sandbox-anim-toggle');
            var isAnimSandboxEligible = hasAnimSandbox && isZamykanaPiaskownicaActive && !isPodestActive;

            if ($animToggle.length) {
                if (isAnimSandboxEligible) {
                    $animToggle.show();
                    if (glbScene) {
                        glbScene.traverse(function(obj) {
                            var n = (obj.name || '').toLowerCase();
                            if (n.includes('piaskownica-animacja') || n.includes('animacja')) {
                                obj.visible = true;
                            }
                        });
                    }
                    if (!prevZamykanaPiaskownicaActive) {
                        setTimeout(function() {
                            setSandboxClosedState(true);
                        }, 50);
                    }
                } else {
                    $animToggle.hide();
                    resetSandboxAnimation();
                    if (glbScene) {
                        glbScene.traverse(function(obj) {
                            var n = (obj.name || '').toLowerCase();
                            if (n.includes('piaskownica-animacja') || n.includes('animacja')) {
                                obj.visible = false;
                            }
                        });
                    }
                }
            }
            prevZamykanaPiaskownicaActive = isAnimSandboxEligible;

            // 4. Aplikuj widoczność dla cech kolorystycznych (atrybutów) zależnych od wariantów geometrycznych
            if (configData.activeAttributes && configData.activeAttributes.length) {
                var hasAnyDeska = false;
                var hasAnyKubelek = false;
                var hasAnyTrapez = false;
                var hasAnyOrczyk = false;

                configData.geometryToggles.forEach(function(tog) {
                    if (disabledToggles[tog.name] || disabledToggles[(tog.name || '').trim()]) return;
                    var selVal = (activeStates[tog.name] || activeStates[(tog.name || '').trim()] || '').toString().toLowerCase();
                    if (selVal.includes('deska') || selVal.includes('deseczk')) hasAnyDeska = true;
                    if (selVal.includes('kubelek') || selVal.includes('kube-kowa')) hasAnyKubelek = true;
                    if (selVal.includes('trapez')) hasAnyTrapez = true;
                    if (selVal.includes('orczyk')) hasAnyOrczyk = true;
                });

                configData.activeAttributes.forEach(function(attr) {
                    var isVisible = true;
                    if (attr.id === 'plastic-deseczka') {
                        isVisible = attr.showWhenToggle ? (activeStates[attr.showWhenToggle] === attr.showWhenValue && !disabledToggles[attr.showWhenToggle]) : hasAnyDeska;
                    } else if (attr.id === 'plastic-kubelek') {
                        isVisible = attr.showWhenToggle ? (activeStates[attr.showWhenToggle] === attr.showWhenValue && !disabledToggles[attr.showWhenToggle]) : hasAnyKubelek;
                    } else if (attr.id === 'plastic-trapez') {
                        isVisible = attr.showWhenToggle ? (activeStates[attr.showWhenToggle] === attr.showWhenValue && !disabledToggles[attr.showWhenToggle]) : hasAnyTrapez;
                    } else if (attr.id === 'plastic-orczyk') {
                        isVisible = attr.showWhenToggle ? (activeStates[attr.showWhenToggle] === attr.showWhenValue && !disabledToggles[attr.showWhenToggle]) : hasAnyOrczyk;
                    } else if (attr.showWhenToggle) {
                        var toggleVal = activeStates[attr.showWhenToggle];
                        if (typeof toggleVal === 'boolean') {
                            var expectedBool = attr.showWhenValue === 'true';
                            isVisible = toggleVal === expectedBool;
                        } else {
                            isVisible = toggleVal === attr.showWhenValue;
                        }
                        
                        // Jeśli wariant nadrzędny, od którego zależy kolor, jest sam w sobie wyłączony, kolor też ukrywamy
                        if (disabledToggles[attr.showWhenToggle] || disabledToggles[(attr.showWhenToggle || '').trim()]) {
                            isVisible = false;
                        }
                    }

                    var $section = $container.find(`.wb3d-ui-section[data-attr-id="${attr.id}"]`);
                    if (isVisible) {
                        $section.show();
                    } else {
                        $section.hide();
                    }
                });
            }

            forceViewerRerender(viewer);
            calculateTotalPrice();
        }

        function setNodeVisibilityDirect(nodeName, isVisible) {
            if (!glbScene || !nodeName) return;
            var cleanTarget = nodeName.replace(/\./g, '').toLowerCase().trim();
            var nodeNameLower = nodeName.toLowerCase().trim();
            var baseTarget = nodeNameLower.replace(/\.\d+$/, '');
            glbScene.traverse(function(obj) {
                if (!obj.name) return;
                var objNameLower = obj.name.toLowerCase().trim();
                var cleanObjName = obj.name.replace(/\./g, '').toLowerCase().trim();
                var baseObj = objNameLower.replace(/\.\d+$/, '');
                if (objNameLower === nodeNameLower || cleanObjName === cleanTarget || baseObj === baseTarget) {
                    obj.visible = isVisible;
                }
            });
            if (cleanTarget.includes('piaskownica-animacja') || cleanTarget.includes('animacja')) {
                glbScene.traverse(function(obj) {
                    if (!obj.name) return;
                    var n = obj.name.toLowerCase();
                    if (n.includes('piaskownica-animacja') || n.includes('animacja')) {
                        obj.visible = isVisible;
                    }
                });
            }
        }

        function centerCameraOnModel(modelViewer) {
            if (!modelViewer) return;

            var cx = 0;
            var cy = 1.0;
            var cz = 0;
            var centerFound = false;

            // 1. Sprawdź natywną funkcję getBoundingBoxCenter() z model-viewer (uwzględnia skalę i aktualne odbicie w scenie)
            if (typeof modelViewer.getBoundingBoxCenter === 'function') {
                try {
                    var center = modelViewer.getBoundingBoxCenter();
                    if (center && typeof center.x === 'number' && !isNaN(center.x)) {
                        cx = center.x;
                        cy = Math.max(0.8, center.y);
                        cz = center.z;
                        centerFound = true;
                    }
                } catch (e) {
                    console.warn("getBoundingBoxCenter warning:", e);
                }
            }

            // 2. Fallback do Three.js scene.boundingBox
            if (!centerFound) {
                var scene = getScene(modelViewer);
                if (scene && scene.boundingBox && !scene.boundingBox.isEmpty()) {
                    var bb = scene.boundingBox;
                    cx = (bb.min.x + bb.max.x) / 2;
                    cy = Math.max(0.8, (bb.min.y + bb.max.y) / 2);
                    cz = (bb.min.z + bb.max.z) / 2;
                    centerFound = true;
                }
            }

            if (centerFound) {
                modelViewer.cameraTarget = `${cx.toFixed(2)}m ${cy.toFixed(2)}m ${cz.toFixed(2)}m`;
            }
        }

        var lastAppliedMirrorState = false;

        async function applyMirrorTransform(isToggle) {
            if (!viewer) return;
            var isMir = !!clientState.isMirrored;
            var scaleStr = isMir ? "-1 1 1" : "1 1 1";
            viewer.setAttribute("scale", scaleStr);
            viewer.scale = scaleStr;

            // Sferyczne odwrócenie kąta azymutu kamery (theta) TYLKO gdy stan lustra faktycznie uległ zmianie
            if (isToggle || isMir !== lastAppliedMirrorState) {
                if (typeof viewer.getCameraOrbit === 'function') {
                    try {
                        var currentOrbit = viewer.getCameraOrbit();
                        if (currentOrbit && typeof currentOrbit.theta === 'number') {
                            var currentThetaDeg = currentOrbit.theta * 180 / Math.PI;
                            var currentPhiDeg = currentOrbit.phi * 180 / Math.PI;
                            var radiusM = currentOrbit.radius;
                            viewer.cameraOrbit = `${(-currentThetaDeg).toFixed(1)}deg ${currentPhiDeg.toFixed(1)}deg ${radiusM.toFixed(2)}m`;
                        }
                    } catch (e) {}
                }
                lastAppliedMirrorState = isMir;
            }

            // Poczekaj na asynchroniczne przeliczenie skali i bounding boxa przez model-viewer
            if (viewer.updateComplete) {
                await viewer.updateComplete;
            }

            // Wycentruj punkt skupienia kamery na odbitym modelu
            centerCameraOnModel(viewer);

            forceViewerRerender(viewer);
        }

        function setMirrorMode(enable) {
            if (clientState.isMirrored === !!enable) return;
            clientState.isMirrored = !!enable;
            applyMirrorTransform(true);
            updateMirrorUI();
        }

        function toggleMirrorMode() {
            setMirrorMode(!clientState.isMirrored);
        }

        function updateMirrorUI() {
            var isMir = !!clientState.isMirrored;
            var $orientSelect = $container.find('#wb3d-orientation-select');
            if ($orientSelect.length) {
                $orientSelect.val(isMir ? 'mirrored' : 'standard');
            }
        }

        function forceViewerRerender(modelViewer) {
            if (!modelViewer) return;

            var scene = getScene(modelViewer);
            if (scene) {
                if (typeof scene.updateBoundingBox === 'function') {
                    scene.updateBoundingBox();
                }
                if (typeof scene.updateShadow === 'function') {
                    scene.updateShadow();
                }
                if (scene.shadow) {
                    scene.shadow.needsUpdate = true;
                }

                // Dynamiczne centrowanie kamery na widocznej geometrii
                centerCameraOnModel(modelViewer);

                if (typeof modelViewer.updateFraming === 'function') {
                    modelViewer.updateFraming();
                } else if (typeof scene.updateFraming === 'function') {
                    scene.updateFraming();
                }

                if (typeof scene.queueRender === 'function') {
                    scene.queueRender();
                }
            }

            var currentExp = parseFloat(modelViewer.getAttribute('exposure') || '1.0');
            var newExp = currentExp === 1.0 ? '1.0001' : '1.0';
            modelViewer.setAttribute('exposure', newExp);

            var needsRenderSym = Object.getOwnPropertySymbols(modelViewer).find(function(s) {
                return s.description === 'needsRender';
            });
            if (needsRenderSym && typeof modelViewer[needsRenderSym] === 'function') {
                modelViewer[needsRenderSym]();
            }
            if (modelViewer.requestUpdate) {
                modelViewer.requestUpdate();
            }
        }

        function setSandboxClosedState(shouldBeClosed) {
            if (!viewer) return;

            var anims = viewer.availableAnimations || [];
            if (!anims || anims.length === 0) return;

            if (typeof shouldBeClosed === "boolean") {
                isSandboxClosed = shouldBeClosed;
                sandboxAnimCounter = isSandboxClosed ? 1 : 0;
            } else {
                sandboxAnimCounter++;
                isSandboxClosed = (sandboxAnimCounter % 2 === 1);
            }

            // Logika identyczna jak w C:\WORK\AR-dema\ciarko:
            // speeds = [1, -1] -> mv.timeScale = speeds[...]; mv.play({ repetitions: 1 });
            var duration = viewer.duration || 3.04;
            if (isSandboxClosed) {
                if (viewer.currentTime >= duration - 0.05) {
                    viewer.currentTime = 0;
                }
                viewer.timeScale = 1;
            } else {
                if (viewer.currentTime <= 0.05) {
                    viewer.currentTime = duration;
                }
                viewer.timeScale = -1;
            }
            viewer.play({ repetitions: 1 });

            var $checkbox = $container.find('#wb3d-sat-checkbox');
            if ($checkbox.length) $checkbox.prop('checked', isSandboxClosed);
        }

        function resetSandboxAnimation() {
            sandboxAnimCounter = 0;
            isSandboxClosed = false;
            var $checkbox = $container.find('#wb3d-sat-checkbox');
            if ($checkbox.length) $checkbox.prop('checked', false);

            if (viewer && viewer.availableAnimations && viewer.availableAnimations.length > 0) {
                viewer.pause();
                viewer.currentTime = 0;
            }
        }

        // Obsługa przełącznika animacji piaskownicy (toggle switch w widoku 3D / AR)
        $container.on('change', '#wb3d-sat-checkbox', function(e) {
            e.stopPropagation();
            setSandboxClosedState($(this).is(':checked'));
        });

        // Kliknięcie w napis lub tło kapsułki przełącza switch
        $container.on('click', '.wb3d-sat-card', function(e) {
            if ($(e.target).closest('.wb3d-sat-switch').length) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            var $cb = $container.find('#wb3d-sat-checkbox');
            var nextState = !$cb.prop('checked');
            $cb.prop('checked', nextState).trigger('change');
        });

        // Obsługa wyboru orientacji placu zabaw (Prawa / Lewa)
        $container.on('change', '#wb3d-orientation-select', function() {
            setMirrorMode($(this).val() === 'mirrored');
        });

        function calculateTotalPrice() {
            var extrasSum = 0;

            // Ustalamy, które warianty są zablokowane
            var activeStates = {};
            configData.geometryToggles.forEach(function(tog) {
                var name = (tog.name || '').trim();
                var val = tog.type === 'checkbox' ? (clientState.toggles[tog.name] === true || clientState.toggles[name] === true) : (clientState.toggles[tog.name] !== undefined ? clientState.toggles[tog.name] : clientState.toggles[name]);
                activeStates[tog.name] = val;
                activeStates[name] = val;
            });

            var disabledToggles = {};

            configData.geometryToggles.forEach(function(tog) {
                var isDisabled = false;
                if (tog.disableWhen) {
                    var dw = tog.disableWhen.trim();
                    isDisabled = activeStates[tog.disableWhen] === true || activeStates[dw] === true;
                }
                if (tog.enableWhen) {
                    var ew = tog.enableWhen.trim();
                    var parentTog = configData.geometryToggles.find(function(t) {
                        return (t.name || '').trim() === ew || t.name === tog.enableWhen;
                    });
                    var parentVal = activeStates[tog.enableWhen] !== undefined ? activeStates[tog.enableWhen] : activeStates[ew];
                    if (tog.enableWhenValue !== undefined && tog.enableWhenValue !== "") {
                        var targetVal = (tog.enableWhenValue || '').toLowerCase().trim();
                        var parentValStr = (parentVal || '').toString().toLowerCase().trim();
                        var parentOpt = parentTog && parentTog.options ? parentTog.options.find(function(o) {
                            return (o.value || '').toLowerCase() === parentValStr;
                        }) : null;
                        var parentLabelStr = parentOpt ? (parentOpt.label || '').toLowerCase().trim() : '';

                        var isMatch = false;
                        if (parentValStr === targetVal) {
                            isMatch = true;
                        } else if (targetVal === 'piaskownica' || targetVal.indexOf('zamykane') !== -1) {
                            isMatch = parentValStr === 'piaskownica' || 
                                      parentValStr.indexOf('zamykane') !== -1 || 
                                      parentLabelStr.indexOf('zamykane') !== -1;
                        } else if (targetVal) {
                            isMatch = parentValStr.indexOf(targetVal) !== -1;
                        }
                        isDisabled = !isMatch;
                    } else {
                        isDisabled = activeStates[tog.enableWhen] !== true && activeStates[ew] !== true;
                    }
                }
                if (isDisabled) {
                    disabledToggles[tog.name] = true;
                    disabledToggles[(tog.name || '').trim()] = true;
                }
            });

            configData.geometryToggles.forEach(function(tog) {
                var isDisabled = disabledToggles[tog.name] === true;
                if (isDisabled) {
                    return; // Pomijamy dopłatę, jeśli wariant jest nieaktywny/wyłączony
                }

                if (tog.type === 'checkbox' && clientState.toggles[tog.name] === true) {
                    extrasSum += tog.price;
                } else if (tog.type === 'select') {
                    var selectedValue = clientState.toggles[tog.name];
                    var selectedOpt = tog.options.find(o => o.value === selectedValue);
                    if (selectedOpt && selectedOpt.price) {
                        extrasSum += parseFloat(selectedOpt.price);
                    }
                }
            });

            var total = configData.basePrice + extrasSum;

            $container.find('.wb3d-extras-price-display').text(formatPrice(extrasSum) + ' zł');
            $container.find('.wb3d-total-price-display').text(formatPrice(total) + ' zł');
        }

        function getScene(modelViewer) {
            var sceneSym = Object.getOwnPropertySymbols(modelViewer).find(
                (x) => x.description === 'scene'
            );
            return sceneSym ? modelViewer[sceneSym] : null;
        }

        viewer.addEventListener('finished', function() {
            viewer.pause();
        });

        viewer.addEventListener('timeupdate', function() {
            if (viewer.timeScale < 0 && viewer.currentTime <= 0.05) {
                viewer.pause();
                viewer.currentTime = 0;
            }
        });

        // ŁADOWANIE MODELU
        viewer.addEventListener('load', function() {
            $container.find('.wb3d-loader-overlay').fadeOut(300);
            
            glbScene = getScene(viewer);
            prevZamykanaPiaskownicaActive = false;
            resetSandboxAnimation();

            initializeConfiguratorState();
            renderConfiguratorUI();
            updateMirrorUI();

            if (configData.activeAttributes) {
                configData.activeAttributes.forEach(function(attr) {
                    var defaultVal = clientState.attributes[attr.id];
                    if (defaultVal) {
                        applyMaterialCustomization(attr.id, attr.type, defaultVal);
                    }
                });
            }

            applyAllGeometryStates();
            resetSandboxAnimation();
        });

        // INTEGRACJA Z FORMULARZEM CONTACT FORM 7 W MODALU
        var $modal = $('#wb3d-inquiry-modal');
        
        // Przenosimy modal na sam koniec <body>, aby uciec z kontekstu nakładania z-index motywu
        if ($modal.length && !$modal.parent().is('body')) {
            $('body').append($modal);
        }

        var $cf7Form = $modal.find('form.wpcf7-form');

        $('#wb3d-trigger-inquiry-modal').on('click', async function(e) {
            e.preventDefault();
            
            var $loader = $container.find('.wb3d-loader-overlay');
            $loader.find('p').text('Trwa przygotowywanie wizualizacji 3D...');
            $loader.fadeIn(200);

            // 1. Wygenerowanie zrzutu ekranu 3D
            var blob = null;
            try {
                blob = await viewer.toBlob({ mimeType: 'image/png' });
            } catch (err) {
                console.error("Zrzut ekranu 3D nie powiódł się", err);
            }

            if (blob && $cf7Form.length) {
                var file = new File([blob], "wizualizacja.png", { type: "image/png" });
                var dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);

                var $fileInput = $cf7Form.find('input[type="file"][name="config-image"], #config-image-input');
                if ($fileInput.length) {
                    $fileInput[0].files = dataTransfer.files;
                }
            }

            // 2. Wygenerowanie podsumowania tekstowego
            if ($cf7Form.length) {
                var summaryText = compileConfigurationSummaryText();
                var $textarea = $cf7Form.find('textarea[name="config-details"], textarea[name="product"], #config-details-input');
                if ($textarea.length) {
                    $textarea.val(summaryText);
                }
            }

            $loader.fadeOut(200);

            // 3. Pokazanie modala popup (dodajemy klasę dla płynnego powiększenia)
            $modal.show(0, function() {
                $modal.addClass('wb3d-active');
            });
        });

        // Zamknięcie modala
        $('#wb3d-modal-close-btn, #wb3d-modal-overlay-el').on('click', function() {
            $modal.removeClass('wb3d-active');
            setTimeout(function() {
                $modal.hide();
            }, 300);
        });

        // Zamknięcie klawiszem ESC
        $(document).on('keydown', function(e) {
            if (e.key === 'Escape' && $modal.hasClass('wb3d-active')) {
                $modal.removeClass('wb3d-active');
                setTimeout(function() {
                    $modal.hide();
                }, 300);
            }
        });

        // Automatyczne zamykanie modala po pomyślnym wysłaniu formularza
        $(document).on('wpcf7mailsent', function(e) {
            if ($modal.find(e.target).length) {
                setTimeout(function() {
                    $modal.removeClass('wb3d-active');
                    setTimeout(function() {
                        $modal.hide();
                    }, 300);
                }, 2500);
            }
        });

        function compileConfigurationSummaryText() {
            var text = `Podsumowanie konfiguracji 3D placu zabaw:\n`;
            text += `--------------------------------------------------\n`;
            text += `Model placu zabaw: ${configData.productName || 'Laura'}\n`;
            text += `Orientacja placu zabaw: ${clientState.isMirrored ? 'Lewa (odbicie lustrzane)' : 'Prawa (standardowa)'}\n\n`;
            
            text += `WYBRANE KOLORY / TEKSTURY:\n`;
            configData.activeAttributes.forEach(function(attr) {
                var $section = $container.find(`.wb3d-ui-section[data-attr-id="${attr.id}"]`);
                if ($section.length && !$section.is(':visible')) {
                    return; // Pomijamy ukryte sekcje kolorystyczne
                }
                var val = clientState.attributes[attr.id];
                var activeOpt = attr.options.find(o => o.value === val);
                text += `  - ${attr.name}: ${activeOpt ? activeOpt.name : val}\n`;
            });
            
            text += `\nWYBRANE DODATKI GEOMETRYCZNE:\n`;
            var extrasSum = 0;

            // Ustalamy, które warianty są zablokowane
            var activeStates = {};
            configData.geometryToggles.forEach(function(tog) {
                var name = (tog.name || '').trim();
                var val = tog.type === 'checkbox' ? (clientState.toggles[tog.name] === true || clientState.toggles[name] === true) : (clientState.toggles[tog.name] !== undefined ? clientState.toggles[tog.name] : clientState.toggles[name]);
                activeStates[tog.name] = val;
                activeStates[name] = val;
            });

            var disabledToggles = {};

            configData.geometryToggles.forEach(function(tog) {
                var isDisabled = false;
                if (tog.disableWhen) {
                    var dw = tog.disableWhen.trim();
                    isDisabled = activeStates[tog.disableWhen] === true || activeStates[dw] === true;
                }
                if (tog.enableWhen) {
                    var ew = tog.enableWhen.trim();
                    var parentTog = configData.geometryToggles.find(function(t) {
                        return (t.name || '').trim() === ew || t.name === tog.enableWhen;
                    });
                    var parentVal = activeStates[tog.enableWhen] !== undefined ? activeStates[tog.enableWhen] : activeStates[ew];
                    if (tog.enableWhenValue !== undefined && tog.enableWhenValue !== "") {
                        var targetVal = (tog.enableWhenValue || '').toLowerCase().trim();
                        var parentValStr = (parentVal || '').toString().toLowerCase().trim();
                        var parentOpt = parentTog && parentTog.options ? parentTog.options.find(function(o) {
                            return (o.value || '').toLowerCase() === parentValStr;
                        }) : null;
                        var parentLabelStr = parentOpt ? (parentOpt.label || '').toLowerCase().trim() : '';

                        var isMatch = false;
                        if (parentValStr === targetVal) {
                            isMatch = true;
                        } else if (targetVal === 'piaskownica' || targetVal.indexOf('zamykane') !== -1) {
                            isMatch = parentValStr === 'piaskownica' || 
                                      parentValStr.indexOf('zamykane') !== -1 || 
                                      parentLabelStr.indexOf('zamykane') !== -1;
                        } else if (targetVal) {
                            isMatch = parentValStr.indexOf(targetVal) !== -1;
                        }
                        isDisabled = !isMatch;
                    } else {
                        isDisabled = activeStates[tog.enableWhen] !== true && activeStates[ew] !== true;
                    }
                }
                if (isDisabled) {
                    disabledToggles[tog.name] = true;
                    disabledToggles[(tog.name || '').trim()] = true;
                }
            });

            configData.geometryToggles.forEach(function(tog) {
                var isDisabled = disabledToggles[tog.name] === true;
                if (isDisabled) {
                    text += `  - ${tog.name}: NIE DOTYCZY (Wyłączone przez inny wybór)\n`;
                    return;
                }

                if (tog.type === 'checkbox') {
                    var isChecked = clientState.toggles[tog.name] === true;
                    var stateVal = isChecked ? 'TAK' : 'NIE';
                    text += `  - ${tog.name}: ${stateVal} (${isChecked ? '+' + formatPrice(tog.price) + ' zł' : '0 zł'})\n`;
                    if (isChecked) extrasSum += tog.price;
                } else if (tog.type === 'select') {
                    var selectedVal = clientState.toggles[tog.name];
                    var activeOpt = tog.options.find(o => o.value === selectedVal);
                    var priceText = '0 zł';
                    if (activeOpt && activeOpt.price > 0) {
                        priceText = '+' + formatPrice(activeOpt.price) + ' zł';
                        extrasSum += parseFloat(activeOpt.price);
                    }
                    text += `  - ${tog.name}: ${activeOpt ? activeOpt.label : selectedVal} (${priceText})\n`;
                }
            });

            var total = configData.basePrice + extrasSum;
            text += `\nPODSUMOWANIE FINANSOWE:\n`;
            text += `  Cena bazowa placu: ${formatPrice(configData.basePrice)} zł\n`;
            text += `  Suma wybranych dodatków: ${formatPrice(extrasSum)} zł\n`;
            text += `  SZACUNKOWA CENA RAZEM: ${formatPrice(total)} zł\n`;
            text += `--------------------------------------------------\n`;
            text += `Obrazek wizualizacji 3D został wygenerowany i dołączony do formularza zapytania.`;

            return text;
        }
    });

    // Pomocnicze funkcje formatowania i konwersji (globalne w obrębie pliku)
    function formatPrice(num) {
        return parseFloat(num).toFixed(2).replace('.', ',').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1 ');
    }

    function hexToRgb(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) return [1, 1, 1, 1];
        
        var r = parseInt(result[1], 16) / 255;
        var g = parseInt(result[2], 16) / 255;
        var b = parseInt(result[3], 16) / 255;
        
        // Konwersja z sRGB Gamma (standardowy CSS) do sRGB Linear (Model-Viewer / WebGL)
        var convertChannel = function(c) {
            return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        };
        
        return [
            convertChannel(r),
            convertChannel(g),
            convertChannel(b),
            1.0
        ];
    }
});
