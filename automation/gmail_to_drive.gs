/**
 * Google Apps Script: copy labeled Gmail PDF attachments into Drive folder.
 *
 * Usage:
 * 1. Create a Gmail label named "Invoices".
 * 2. Replace FOLDER_ID with the target Drive folder ID.
 * 3. Add a time-driven trigger (e.g., every 5 minutes) to run saveInvoicesToDrive.
 */

const FOLDER_ID = 'REPLACE_WITH_DRIVE_FOLDER_ID'
const LABEL_NAME = 'Invoices'
const CONTENT_TYPE = 'application/pdf'

function saveInvoicesToDrive() {
  const label = GmailApp.getUserLabelByName(LABEL_NAME)
  if (!label) {
    Logger.log(`Label "${LABEL_NAME}" not found. Aborting.`)
    return
  }

  const folder = DriveApp.getFolderById(FOLDER_ID)
  const threads = label.getThreads()

  threads.forEach((thread) => {
    thread.getMessages().forEach((message) => {
      const attachments = message.getAttachments({ includeInlineImages: false })
      attachments
        .filter((attachment) => attachment.getContentType() === CONTENT_TYPE)
        .forEach((attachment) => {
          const file = folder.createFile(attachment)
          file.setDescription(`Imported from Gmail message: ${message.getSubject()}`)
        })
    })

    // Prevent double processing
    thread.removeLabel(label)
    thread.addLabel(GmailApp.getOrCreateLabel(`${LABEL_NAME}/processed`))
  })
}


