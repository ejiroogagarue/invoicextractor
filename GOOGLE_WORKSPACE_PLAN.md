## Layra Google Workspace Build Notes

### 1. Google Cloud Project Setup
- Ensure the following APIs are enabled: **Drive API**, **Gmail API**, **Sheets API**.
- OAuth consent screen: Internal (workspace users only), add `https://localhost` origins for local testing.
- Credentials:
  - **OAuth Web Client ID** – used by the React frontend.
  - **Service Account** – used by the backend for Drive/Sheets access.
- Share the `Invoices` Drive folder and target Google Sheet with the service-account email.

### 2. Environment Variables

#### Backend (`.env`)
| Key | Description |
| --- | --- |
| `GOOGLE_APPLICATION_CREDENTIALS` | Absolute path to the service-account JSON file. |
| `GOOGLE_DRIVE_INVOICE_FOLDER_ID` | Folder ID where invoices are dropped. |
| `GOOGLE_SHEET_EXPORT_ID` | Spreadsheet ID for exports. |
| `GOOGLE_SHEET_EXPORT_TAB` | Sheet/tab name to write data into (default `ProcessedInvoices`). |

#### Frontend (`.env`)
| Key | Description |
| --- | --- |
| `VITE_GOOGLE_CLIENT_ID` | OAuth client ID for the web app. |

Store secrets in local `.env` files only. Never commit the service-account key or client secret.

### 3. Gmail → Drive Automation (Apps Script Outline)
1. Create Gmail label `Invoices`.
2. Apps Script pseudocode:
   ```javascript
   function saveInvoicesToDrive() {
     const label = GmailApp.getUserLabelByName('Invoices');
     const folder = DriveApp.getFolderById('GOOGLE_DRIVE_INVOICE_FOLDER_ID');
     label.getThreads().forEach(thread => {
       thread.getMessages().forEach(message => {
         message.getAttachments({includeInlineImages: false}).forEach(attachment => {
           if (attachment.getContentType() === 'application/pdf') {
             folder.createFile(attachment);
           }
         });
       });
       thread.removeLabel(label);
     });
   }
   ```
3. Add a time-driven trigger (every 5 minutes).

### 4. Backend Work Items
- Implement Drive adapter helpers: `list_unprocessed_files`, `download_file`, `mark_processed`.
- Endpoint `POST /google/process-folder` to loop over new files and feed the OCR pipeline.
- Endpoint `GET /google/status` to report processed invoice metadata.
- Store processed file IDs in a small manifest (JSON or database) to avoid duplicates.

### 5. Frontend Work Items
- Add Google OAuth login using `@react-oauth/google`.
- Protect dashboard routes; require sign-in to trigger processing.
- Add “Process Google Drive now” button and status surface.

### 6. Sheets Export
- Backend helper writes summary + line items to the configured sheet via Sheets API.
- Dashboard button triggers export; keep CSV download.

### 7. Testing Checklist
- Send sample invoice email → label `Invoices`.
- Confirm Apps Script drops PDF into Drive folder.
- Run `/google/process-folder` and verify invoices appear in dashboard.
- Trigger Sheets export; data populates the spreadsheet.
- Document setup steps and environment variables for teammates.


