// App per Mac di Gioco Folle!: apre una finestra con il gioco (file in dist-desktop/, inclusi nell'app).
// Nessun server e nessuna rete: partite e preferenze restano salvate sul computer.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        // apre i link esterni (segnalazioni, crediti) nel browser di sistema
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("errore all'avvio di Gioco Folle!");
}
