=== Wooden Boyz 3D Configurator ===
Contributors: colordrop
Tags: 3d, model-viewer, single-product, configurator, contact-form-7, woocommerce
Requires at least: 5.6
Tested up to: 6.3
Stable tag: 1.2.0
License: GPLv2 or later

Interaktywny konfigurator 3D placów zabaw zintegrowany z Contact Form 7.

== Opis ==

Wtyczka umożliwia klientom konfigurację placów zabaw w 3D bezpośrednio na stronie. Posiada centralny panel administratora w kokpicie do zarządzania wszystkimi modelami w jednym miejscu oraz automatycznie odczytuje strukturę plików GLB, umożliwiając łatwe tworzenie wariantów geometrycznych (np. zmiana huśtawki na ściankę wspinaczkową).

Wtyczka w pełni integruje się z Contact Form 7, automatycznie przesyłając zrzut ekranu spersonalizowanego modelu (jako załącznik graficzny) oraz tekstową specyfikację wyboru w treści maila.

== Instalacja ==

1. Spakuj katalog `wooden-boyz-3d-configurator` do pliku `.zip`.
2. W panelu WordPress przejdź do sekcji **Wtyczki -> Dodaj nową -> Wyślij wtyczkę na serwer** i wybierz spakowany plik `.zip`.
3. Aktywuj wtyczkę.
4. Przejdź do nowo powstałej zakładki **Konfigurator 3D** w menu głównym kokpitu:
   * W zakładce **Cechy Globalne** zdefiniuj globalne kolory i tekstury.
   * W zakładce **Modele 3D** dodaj nową konfigurację (np. Laura), wgraj plik GLB, przypisz aktywne cechy globalne, stwórz warianty geometryczne i kliknij Zapisz.
5. Skopiuj wygenerowany w tabeli shortcode wariantu (np. `[wooden_boyz_3d_configurator id="model_1625..." cf7_id="123"]`).
6. Dodaj formularz w Contact Form 7 (patrz sekcja Konfiguracja CF7 poniżej).
7. Wklej skopiowany shortcode na dowolnej stronie WordPress.

== Konfiguracja Contact Form 7 ==

Aby formularz poprawnie odbierał i przesyłał specyfikację oraz obrazek z modelu 3D, wykonaj następujące kroki:

1. Przejdź do **Formularze -> Dodaj nowy** (lub edytuj istniejący).
2. W zakładce **Formularz** doklej następujące pola (najlepiej na samym dole formularza):
   `[file config-image id:config-image-input class:hidden]`
   `[textarea config-details id:config-details-input class:hidden]`
   *(Uwaga: wtyczka automatycznie ukryje te pola na stronie, są one wykorzystywane do przekazania danych w tle).*
3. Przejdź do zakładki **E-mail**.
4. W polu **Treść wiadomości** dopisz tag: `[config-details]` (tam pojawi się tekstowe zestawienie wyborów klienta).
5. W polu **Załączniki** (na samym dole) dopisz tag: `[config-image]` (dzięki temu zrzut ekranu 3D zostanie załączony do maila jako plik PNG).
6. Zapisz formularz i skopiuj jego ID do shortcode'u wtyczki.
