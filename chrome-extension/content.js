// LinkedIn Data Extractor Content Script

function extractLinkedInData() {
  const data = {
    fullName: document.querySelector('h1.text-heading-xlarge')?.innerText.trim(),
    headline: document.querySelector('div.text-body-medium')?.innerText.trim(),
    location: document.querySelector('span.text-body-small.inline.t-black--light.break-words')?.innerText.trim(),
    experience: [],
    education: [],
    skills: [],
    about: document.querySelector('div.display-flex.ph5.pv3 div.inline-show-more-text')?.innerText.trim()
  };

  // Extract Experience
  const experienceSection = document.querySelector('section#experience-section') || 
                            Array.from(document.querySelectorAll('section')).find(s => s.querySelector('#experience'));
  
  if (experienceSection) {
    const items = experienceSection.querySelectorAll('li.artdeco-list__item');
    items.forEach(item => {
      const title = item.querySelector('.display-flex.align-items-center.mr1.t-bold span')?.innerText.trim();
      const company = item.querySelector('.t-14.t-normal span')?.innerText.trim();
      const duration = item.querySelector('.t-14.t-normal.t-black--light span')?.innerText.trim();
      const description = item.querySelector('.inline-show-more-text')?.innerText.trim();
      
      if (title && company) {
        data.experience.push({ title, company, duration, description });
      }
    });
  }

  // Extract Education
  const educationSection = document.querySelector('section#education-section') || 
                           Array.from(document.querySelectorAll('section')).find(s => s.querySelector('#education'));
  if (educationSection) {
    const items = educationSection.querySelectorAll('li.artdeco-list__item');
    items.forEach(item => {
      const school = item.querySelector('.display-flex.align-items-center.mr1.t-bold span')?.innerText.trim();
      const degree = item.querySelector('.t-14.t-normal span')?.innerText.trim();
      const date = item.querySelector('.t-14.t-normal.t-black--light span')?.innerText.trim();
      
      if (school) {
        data.education.push({ school, degree, date });
      }
    });
  }

  // Extract Skills
  const skillsSection = Array.from(document.querySelectorAll('section')).find(s => s.querySelector('#skills'));
  if (skillsSection) {
    const items = skillsSection.querySelectorAll('.display-flex.align-items-center.mr1.t-bold span');
    items.forEach(item => {
      const skill = item.innerText.trim();
      if (skill && !data.skills.includes(skill)) {
        data.skills.push(skill);
      }
    });
  }

  return data;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extract") {
    const profileData = extractLinkedInData();
    sendResponse({ data: profileData });
  }
});
