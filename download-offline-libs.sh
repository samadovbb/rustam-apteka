#!/bin/bash

# Script to download required JavaScript libraries for offline use
# Run this script on a machine with internet access

echo "Creating vendor directories..."
mkdir -p src/public/vendor/jquery
mkdir -p src/public/vendor/select2/css
mkdir -p src/public/vendor/select2/js
mkdir -p src/public/vendor/sweetalert2

echo "Downloading jQuery..."
curl -o src/public/vendor/jquery/jquery.min.js https://code.jquery.com/jquery-3.6.0.min.js

echo "Downloading Select2 CSS..."
curl -o src/public/vendor/select2/css/select2.min.css https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css

echo "Downloading Select2 JS..."
curl -o src/public/vendor/select2/js/select2.min.js https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js

echo "Downloading SweetAlert2 CSS..."
curl -o src/public/vendor/sweetalert2/sweetalert2.min.css https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css

echo "Downloading SweetAlert2 JS..."
curl -o src/public/vendor/sweetalert2/sweetalert2.min.js https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js

echo "Done! All libraries downloaded successfully."
echo "You can now use the application offline."
