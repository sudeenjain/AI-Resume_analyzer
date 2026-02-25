chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "saveData") {
    // In a real app, you'd send this to your backend
    // fetch('https://your-app.run.app/api/linkedin/save', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(request.data)
    // });
    console.log("Data received in background:", request.data);
    sendResponse({ status: "success" });
  }
});
