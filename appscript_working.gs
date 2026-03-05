// ============================================================
// GOOGLE APPS SCRIPT — Jesus Saves Ministry Registration
// Single-submit: Registration + GCash Proof in ONE row
// ============================================================
// SETUP:
// 1. Go to script.google.com → New Project → paste this code
// 2. Replace SHEET_ID, FOLDER_ID, and ADMIN_EMAIL below
// 3. Run testSetup() manually to confirm your IDs work
// 4. Deploy → New Deployment → Web App
//    - Execute as: Me
//    - Who has access: Anyone
// 5. Copy the Web App URL → paste into index.html as scriptURL
// ============================================================

const SHEET_ID    = '1RJBM9CSN4keRSpjW_dK5gJ1dqd6ggWmoytFzOv6HIuk';   // ← replace
const FOLDER_ID   = '15xWuUAAyhwRza2jFEgO33vkfiijJZwar';   // ← replace
const ADMIN_EMAIL = 'zajamhowie@gmail.com';    // ← replace

// ------------------------------------------------------------
// doPost — single action handles everything
// ------------------------------------------------------------
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    return handleRegistration(data);
  } catch (err) {
    Logger.log('doPost error: ' + err.message);
    return jsonResponse({ success: false, error: err.message });
  }
}

// ------------------------------------------------------------
// handleRegistration — saves info + uploads proof in one row
// ------------------------------------------------------------
function handleRegistration(data) {

  // ── 1. Upload GCash screenshot to Drive ──
  let fileUrl = 'No proof uploaded';

  if (data.fileData && data.fileName) {
    try {
      const decoded  = Utilities.base64Decode(data.fileData);
      const mimeType = data.fileType || 'image/jpeg';

      // Name the file after the registrant for easy identification
      const safeName = (data.surname + '_' + data.firstname).replace(/[^a-zA-Z0-9_]/g, '_');
      const ext      = data.fileName.split('.').pop();
      const newName  = safeName + '_proof.' + ext;

      const blob   = Utilities.newBlob(decoded, mimeType, newName);
      const folder = DriveApp.getFolderById(FOLDER_ID);
      const file   = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      fileUrl = file.getUrl();
    } catch (uploadErr) {
      Logger.log('Upload error: ' + uploadErr.message);
      fileUrl = 'Upload failed: ' + uploadErr.message;
    }
  }

  // ── 2. Get or create the Registrations sheet ──
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  let sheet   = ss.getSheetByName('Registrations');

  if (!sheet) {
    sheet = ss.insertSheet('Registrations');
    const headers = [
      'Timestamp',
      'Surname',
      'First Name',
      'Middle Name',
      'Email',
      'Contact Number',
      'Proof of Payment',   // ← clickable Drive link
      'Status'
    ];
    sheet.appendRow(headers);

    // Style headers
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange
      .setBackground('#1e3a5f')
      .setFontColor('#ffffff')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
  }

  // ── 3. Append the row ──
  const now = new Date();
  const timestamp = Utilities.formatDate(now, 'Asia/Manila', 'yyyy-MM-dd HH:mm:ss');
  const lastRow = sheet.getLastRow() + 1;

  sheet.appendRow([
    timestamp,
    data.surname    || '',
    data.firstname  || '',
    data.middlename || '',
    data.email      || '',
    data.contact    || '',
    fileUrl,
    'Pending Verification'
  ]);

  // Make the Drive link a proper hyperlink in the cell
  if (fileUrl.startsWith('https')) {
    const linkCell = sheet.getRange(lastRow, 7); // column G = Proof of Payment
    linkCell.setFormula('=HYPERLINK("' + fileUrl + '","View Screenshot")');
    linkCell.setFontColor('#0070e0');
  }

  sheet.autoResizeColumns(1, 8);

  // ── 4. Email confirmation to registrant ──
  if (data.email) {
    try {
      MailApp.sendEmail({
        to: data.email,
        subject: '✝ Registration Received – Jesus Saves Ministry',
        htmlBody: buildRegistrantEmail(data)
      });
    } catch (mailErr) {
      Logger.log('Registrant email error: ' + mailErr.message);
    }
  }

  // ── 5. Notify admin ──
  if (ADMIN_EMAIL) {
    try {
      MailApp.sendEmail({
        to: ADMIN_EMAIL,
        subject: '🔔 New Registrant: ' + data.firstname + ' ' + data.surname,
        htmlBody: buildAdminEmail(data, fileUrl)
      });
    } catch (adminErr) {
      Logger.log('Admin email error: ' + adminErr.message);
    }
  }

  return jsonResponse({ success: true });
}

// ------------------------------------------------------------
// Email — confirmation to registrant
// ------------------------------------------------------------
function buildRegistrantEmail(data) {
  return '<div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;background:#fdfaf3;border-radius:12px;overflow:hidden;border:1px solid #d4a93e">'
    + '<div style="background:linear-gradient(135deg,#1e3a5f,#4a7aad);padding:32px;text-align:center">'
    + '<div style="font-size:2.5rem;color:#b8922a">✝</div>'
    + '<h1 style="color:#f5e9c8;font-size:22px;margin:10px 0 4px">Jesus Saves Ministry</h1>'
    + '<p style="color:rgba(255,255,255,0.75);margin:0;font-size:13px">Registration Confirmation</p>'
    + '</div>'
    + '<div style="padding:32px">'
    + '<p style="font-size:16px">Dear <strong>' + data.firstname + ' ' + data.surname + '</strong>,</p>'
    + '<p style="line-height:1.7;color:#444">Thank you for registering! We have received your registration and payment proof. Our team will verify your GCash payment and confirm your slot shortly.</p>'
    + '<div style="background:#fff;border-left:4px solid #b8922a;border-radius:6px;padding:16px;margin:20px 0">'
    + '<p style="margin:0 0 8px;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:.06em">Your Details</p>'
    + '<p style="margin:4px 0"><strong>Name:</strong> ' + data.firstname + ' ' + (data.middlename ? data.middlename + ' ' : '') + data.surname + '</p>'
    + '<p style="margin:4px 0"><strong>Email:</strong> ' + data.email + '</p>'
    + '<p style="margin:4px 0"><strong>Contact:</strong> ' + data.contact + '</p>'
    + '<p style="margin:4px 0"><strong>Payment Proof:</strong> ✅ Submitted</p>'
    + '</div>'
    + '<p style="font-style:italic;color:#b8922a;font-size:13px;margin-top:24px;border-top:1px solid #e8e4d8;padding-top:16px">"For God so loved the world that He gave His one and only Son…" — John 3:16</p>'
    + '</div>'
    + '<div style="background:#1e3a5f;padding:14px;text-align:center">'
    + '<p style="color:rgba(255,255,255,0.55);font-size:12px;margin:0">© ' + new Date().getFullYear() + ' Jesus Saves Ministry ✝</p>'
    + '</div></div>';
}

// ------------------------------------------------------------
// Email — admin notification with View Screenshot link
// ------------------------------------------------------------
function buildAdminEmail(data, fileUrl) {
  const proofCell = fileUrl.startsWith('https')
    ? '<a href="' + fileUrl + '" style="color:#0070e0;font-weight:bold">View GCash Screenshot →</a>'
    : '<span style="color:#c0392b">' + fileUrl + '</span>';

  return '<div style="font-family:Arial,sans-serif;max-width:560px">'
    + '<h2 style="color:#1e3a5f">🔔 New Registration + Payment Proof</h2>'
    + '<table style="border-collapse:collapse;width:100%">'
    + '<tr><td style="padding:8px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold;width:160px">Name</td>'
    + '<td style="padding:8px;border:1px solid #ddd">' + data.firstname + ' ' + (data.middlename || '') + ' ' + data.surname + '</td></tr>'
    + '<tr><td style="padding:8px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold">Email</td>'
    + '<td style="padding:8px;border:1px solid #ddd">' + data.email + '</td></tr>'
    + '<tr><td style="padding:8px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold">Contact</td>'
    + '<td style="padding:8px;border:1px solid #ddd">' + data.contact + '</td></tr>'
    + '<tr><td style="padding:8px;border:1px solid #ddd;background:#f5f5f5;font-weight:bold">Proof of Payment</td>'
    + '<td style="padding:8px;border:1px solid #ddd">' + proofCell + '</td></tr>'
    + '</table>'
    + '<p style="margin-top:16px">Please verify the GCash screenshot and update the <strong>Status</strong> column in your sheet.</p>'
    + '<p><a href="https://docs.google.com/spreadsheets/d/' + SHEET_ID + '" style="color:#1e3a5f;font-weight:bold">Open Google Sheets →</a></p>'
    + '<p style="color:#aaa;font-size:12px">Jesus Saves Ministry — Registration System</p>'
    + '</div>';
}

// ------------------------------------------------------------
// Helper
// ------------------------------------------------------------
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ------------------------------------------------------------
// testSetup — run this manually before deploying!
// ------------------------------------------------------------
function testSetup() {
  try {
    const sheet  = SpreadsheetApp.openById(SHEET_ID);
    const folder = DriveApp.getFolderById(FOLDER_ID);
    Logger.log('✅ Sheet:  ' + sheet.getName());
    Logger.log('✅ Folder: ' + folder.getName());
    Logger.log('✅ Ready to deploy!');
  } catch (err) {
    Logger.log('❌ Error: ' + err.message);
    Logger.log('Double-check your SHEET_ID and FOLDER_ID.');
  }
}
function requestDriveAccess() {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  Logger.log('✅ Drive access granted! Folder: ' + folder.getName());
}
function requestFullDriveAccess() {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const testBlob = Utilities.newBlob('test', 'text/plain', 'permission_test.txt');
  const testFile = folder.createFile(testBlob);
  testFile.setTrashed(true); // deletes the test file immediately
  Logger.log('✅ Full Drive access confirmed!');
}