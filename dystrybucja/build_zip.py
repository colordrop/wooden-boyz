import os
import zipfile

def build_plugin_zip():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, '..'))
    base_dir = os.path.join(project_root, 'wp-plugin', 'wooden-boyz-3d-configurator')
    zip_path = os.path.join(project_root, 'dystrybucja', 'wooden-boyz-3d-configurator.zip')

    if not os.path.exists(base_dir):
        raise FileNotFoundError(f"Source dir not found: {base_dir}")

    print(f"Building ZIP from: {base_dir}")
    print(f"Output: {zip_path}")

    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(base_dir):
            for file in sorted(files):
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, os.path.dirname(base_dir))
                # Ensure standard forward slash for Linux compatibility
                arcname = rel_path.replace(os.sep, '/')
                zf.write(full_path, arcname)
                print(f"  + {arcname}")

    print("ZIP package built successfully with forward slashes.")

if __name__ == '__main__':
    build_plugin_zip()
