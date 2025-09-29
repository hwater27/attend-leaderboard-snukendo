// Edit these values to point to your Google Sheet.
// Make the sheet viewable or Publish to the web to allow public access.

window.LEADERBOARD_CONFIG = {
  // Google Sheet ID: the long ID in the URL between /d/ and /edit
  // Example URL: https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890/edit
  SHEET_ID: "1xvrogq5rztV9VMbxJd3m7TfmgXzTLN7H1f0DclwqT3I",
  //https://docs.google.com/spreadsheets/d/1xvrogq5rztV9VMbxJd3m7TfmgXzTLN7H1f0DclwqT3I/edit?gid=0#gid=0

  // Sheet gid: found at the end of the URL (?gid=123456789); use the tab you want (numbers only)
  GID: "0",
  // Optional: sheet name (tab name). If provided, this will be used instead of GID.
  // Example: SHEET_NAME: "2025 Fall"
  SHEET_NAME: "",

  // Column labels in your sheet for Name and Attendance total
  COLUMNS: {
    name: "Name",
    attendance: "Attendance",
    events: "Events", // optional; if present, used for +Events mode
    board: "Board Member" // optional; 'o' means board member
  },

  // Optional: override site title
  TITLE: "Snukendo Attendance Leaderboard"
  ,
  // Threshold for +Events mode separator line (change this single number)
  THRESHOLD: 8
};

