# Offline Setup Instructions

This application has been configured to work offline without internet access. However, you need to download the required JavaScript libraries first.

## Download Libraries

On a computer with internet access, run the following command in the project root:

```bash
bash download-offline-libs.sh
```

This will download:
- jQuery 3.6.0
- Select2 4.1.0-rc.0
- SweetAlert2 11.x

The files will be saved to `src/public/vendor/` directory.

## Manual Download (Alternative)

If the script doesn't work, manually download and place the files:

### jQuery
- Download: https://code.jquery.com/jquery-3.6.0.min.js
- Save to: `src/public/vendor/jquery/jquery.min.js`

### Select2
- Download CSS: https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css
- Save to: `src/public/vendor/select2/css/select2.min.css`
- Download JS: https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js
- Save to: `src/public/vendor/select2/js/select2.min.js`

### SweetAlert2
- Download CSS: https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css
- Save to: `src/public/vendor/sweetalert2/sweetalert2.min.css`
- Download JS: https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js
- Save to: `src/public/vendor/sweetalert2/sweetalert2.min.js`

## Transfer to Offline Computer

After downloading, transfer the entire `src/public/vendor/` directory to your offline computer at the same path in the project.

## Verify Setup

1. Start the application: `npm start`
2. Open the application in a browser
3. Check the browser console for any 404 errors
4. Test functionality like creating a sale or stock intake

If everything works correctly, the application is ready for offline use!
