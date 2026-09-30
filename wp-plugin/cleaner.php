<?php
/**
 * Narzędzie czyszczące pliki z ukośnikami wstecznymi (backslash)
 * Umieść ten plik w głównym katalogu swojej instalacji WordPress (tam gdzie wp-config.php)
 * i uruchom go w przeglądarce: http://colorodrop.pl/cleaner.php
 */

header('Content-Type: text/html; charset=utf-8');

$plugins_dir = __DIR__ . '/wp-content/plugins';

echo "<h2>Rozpoczynanie czyszczenia katalogu wtyczek...</h2>";

if (!is_dir($plugins_dir)) {
    die("<p style='color:red;'>Błąd: Nie znaleziono katalogu wtyczek pod adresem: " . htmlspecialchars($plugins_dir) . "</p>");
}

$files = scandir($plugins_dir);
$deleted_count = 0;

foreach ($files as $file) {
    // Sprawdzamy czy nazwa pliku zaczyna się od nazwy naszej wtyczki i zawiera znak backslash \
    if (strpos($file, 'wooden-boyz-3d-configurator') === 0 && strpos($file, '\\') !== false) {
        $full_path = $plugins_dir . '/' . $file;
        
        if (is_file($full_path)) {
            if (unlink($full_path)) {
                echo "<p style='color:green;'>Pomyślnie usunięto plik wtyczki: <strong>" . htmlspecialchars($file) . "</strong></p>";
                $deleted_count++;
            } else {
                echo "<p style='color:red;'>Nie udało się usunąć pliku wtyczki: " . htmlspecialchars($file) . "</p>";
            }
        }
    }
}

// Sprawdźmy też czy istnieje niedousunięty folder o nazwie drewnianych chłopców
$bad_dirs = array('wooden-boyz-3d-configurator-1', 'wooden-boyz-3d-configurator');
foreach ($bad_dirs as $bad_dir) {
    $dir_path = $plugins_dir . '/' . $bad_dir;
    if (is_dir($dir_path)) {
        // Usuwanie rekurencyjne poprawnego folderu (teraz z ukośnikami /)
        if (rrmdir($dir_path)) {
            echo "<p style='color:green;'>Pomyślnie usunięto stary uszkodzony katalog: <strong>" . htmlspecialchars($bad_dir) . "</strong></p>";
            $deleted_count++;
        }
    }
}

echo "<h3>Czyszczenie zakończone. Usunięto elementów: $deleted_count</h3>";
echo "<p style='color:blue;'>Możesz teraz bezpiecznie usunąć ten plik (cleaner.php) z serwera i wgrać nową wtyczkę .zip.</p>";

// Pomocnicza funkcja do rekurencyjnego usuwania katalogu
function rrmdir($dir) {
    if (is_dir($dir)) {
        $objects = scandir($dir);
        foreach ($objects as $object) {
            if ($object != "." && $object != "..") {
                if (is_dir($dir . "/" . $object)) {
                    rrmdir($dir . "/" . $object);
                } else {
                    unlink($dir . "/" . $object);
                }
            }
        }
        return rmdir($dir);
    }
    return false;
}
