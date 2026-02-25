document.getElementById('extractBtn').addEventListener('click', async () => {
  const status = document.getElementById('status');
  status.innerText = "Extracting...";
  
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url.includes("linkedin.com/in/")) {
    status.innerText = "Please go to your LinkedIn profile page.";
    return;
  }

  chrome.tabs.sendMessage(tab.id, { action: "extract" }, (response) => {
    if (chrome.runtime.lastError) {
      status.innerText = "Error: " + chrome.runtime.lastError.message;
      return;
    }

    if (response && response.data) {
      // Save to storage so the main app can pick it up
      chrome.storage.local.set({ linkedinData: response.data }, () => {
        status.innerText = "Success! Data extracted.";
        console.log(response.data);
      });
    } else {
      status.innerText = "Failed to extract data.";
    }
  });
});
