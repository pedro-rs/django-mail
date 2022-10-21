const LOAD_CHUNK = 20; // Number of new emails loaded every chunck
let current_mailbox = 'inbox';

document.addEventListener('DOMContentLoaded', function() {

  // Use buttons to toggle between views
  document.querySelector('#inbox').addEventListener('click', () => mailboxView('inbox'));
  document.querySelector('#sent').addEventListener('click', () => mailboxView('sent'));
  document.querySelector('#archive').addEventListener('click', () => mailboxView('archive'));
  document.querySelector('#compose').addEventListener('click', composeView);

  // Listening for a new email sent
  document.querySelector('#compose-form').style.display = 'none';
  document.querySelector('#compose-form').onsubmit = () => {
    const recipient = document.querySelector('#compose-recipients').value;
    const subject = document.querySelector('#compose-subject').value;
    const body = document.querySelector('#compose-body').value;

    sendEmail(recipient, subject, body);
  }

  const popup = document.querySelector('#popup');
  popup.style.display = 'none'; 
  document.querySelector('#user-icon').onclick = () => {
    if (popup.style.display === 'none') 
      popup.style.display = 'grid'; 
    else
      popup.style.display = 'none'; 
  }

  displayCounter();

  // By default, load the inbox
  mailboxView('inbox');
});

async function displayCounter() {
  const mailbox_counters = document.querySelectorAll('.mailbox-count');
  for (mailbox of mailbox_counters) {
    const count = await emailCount(mailbox.parentElement.id);
    console.log(`${mailbox.parentElement.id} has ${count} emails.`);
    mailbox.innerHTML = count;
  }
}

async function emailCount(mailbox) {
  var len;

  await fetch(`/emails/${mailbox}`)
  .then(response => response.json())
  .then(emails => {
    len = Object.keys(emails).length;
  });

  return len;
}

function composeView() {
  // Block click actions for background elements
  document.querySelector('#popup-background').style.display = 'block';

  // Hide compose button
  document.querySelector('#compose').style.display = 'none';

  // Show compose form
  document.querySelector('#compose-form').style.display = 'block';
  
  // Blur background
  document.querySelector('#sidebar').classList.add('blur');
  document.querySelector('#mailbox').classList.add('blur');

  // Clear out composition fields
  document.querySelector('#compose-recipients').value = '';
  document.querySelector('#compose-subject').value = '';
  document.querySelector('#compose-body').value = '';
  
  // Reset when closing compose form
  document.querySelector('#popup-background').onclick = () => {
    document.querySelector('#compose-form').style.display = 'none';
    document.querySelector('#sidebar').classList.remove('blur');
    document.querySelector('#mailbox').classList.remove('blur');
    document.querySelector('#popup-background').style.display = 'none';
    document.querySelector('#compose').style.display = 'block';
  }

}

function mailboxView(mailbox) {
  current_mailbox = mailbox;

  // Show the mailbox and hide other views
  document.querySelector('#emails-view').style.display = 'grid';
  document.querySelector('#compose-form').style.display = 'none';
  document.querySelector('#read-view').style.display = 'none';

  // Remove selector from previous selected mailbox and add to new
  document.querySelector('.selected-mailbox').classList.remove('selected-mailbox');
  document.querySelector(`#${mailbox}`).classList.add('selected-mailbox');

  document.querySelector('#mailbox-body').innerHTML = ''; // Clear emails
  displayEmails(mailbox, 0, LOAD_CHUNK); // Display 25 emails as default
  localStorage.setItem('loaded', LOAD_CHUNK)
}

// View for reading an email (clicked in inbox)
async function readView(id, mailbox) {
  // Mark as read on server (API)
  fetch(`/emails/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
        read: true
    })
  })

  // Clear previous content
  document.querySelector('#mailbox-body').innerHTML = ''; // Clear emails
  document.querySelector('#read-view').innerHTML = ''; // Clear previous read view

  document.querySelector('#read-view').style.display = 'block';

  // Fecth requested email
  let email = await fetch(`/emails/${id}`).then(response => response.json());

  // Display information
  const subject = document.createElement('div');
  subject.innerHTML = email.subject;
  document.querySelector('#read-view').append(subject);
  
  const body = document.createElement('div');
  body.innerHTML = email.body;
  document.querySelector('#read-view').append(body);

  if(mailbox != 'sent') {
    const archive = document.createElement('button');
    archive.innerHTML = "Archive";
    archive.onclick = () => archiveEmail(email);
    document.querySelector('#read-view').append(archive);
  }
  
}

function sendEmail(recipient, subject, body) {
  fetch('/emails', {
    method: 'POST',
    body: JSON.stringify({
      recipients: recipient,
      subject: subject,
      body: body
    })
  })
  .then(response => response.json())
  .then(result => {
    console.log(result);
  });
}

// Retrieve all emails from a given mailbox
async function retrieveEmails(mailbox) {
  return await fetch(`/emails/${mailbox}`).then(response => response.json());
}

// Generate a display for the email (inbox view).
function miniatureDisplay(email) {
  const display = document.createElement('div');
  display.classList.add('email');
  if(email.read) display.classList.add('read');

  const pfp = document.createElement('img');
  pfp.classList.add('email-pfp');
  pfp.src = '/static/mail/icons/male1.png';
  display.appendChild(pfp);

  const sender = document.createElement('p');
  sender.classList.add('email-sender');
  sender.innerHTML = email.sender;
  display.appendChild(sender);

  const subject = document.createElement('p');
  subject.classList.add('email-subject');
  subject.innerHTML = email.subject;
  display.appendChild(subject);

  const body = document.createElement('p');
  body.classList.add('email-body');
  body.innerHTML = "▸ ".concat(email.body);
  display.appendChild(body);

  display.onclick = (b) => readView(email.id, mailbox);

  // Archivability
  if(current_mailbox != 'sent') {
    const archive = document.createElement('img');
    archive.className = 'archive-icon';
    archive.src = '/static/mail/icons/archive.svg';
    archive.onclick = (event) => {
      event.stopPropagation();
      event.target.parentNode.remove(); // TODO: Animation
      archiveEmail(email);
      displayCounter(current_mailbox); // Update counters
    };

    display.appendChild(archive);
  }

  return display;
}

// Loads the display for emails in inbox in given range ([from, upto])
async function displayEmails(mailbox, from, upto) {
  const emails = await retrieveEmails(mailbox);
  console.log(emails);

  // Validate limits (assure from and upto are in range of available emails)
  const n_retrieved_emails = Object.keys(emails).length;
  console.log(`Retrieved [${n_retrieved_emails}] emails`);
  if(from > n_retrieved_emails) { 
    console.log("here 1");
    return;
  }

  if(upto >= n_retrieved_emails) {
    upto = n_retrieved_emails;
    console.log("here 2");
  }

  // Displaying elements on page
  for (let i = from; i < upto; i++) {
    console.log(`Appending e-mail. Subject: "${emails[i].subject}"`)
    document.querySelector('#mailbox-body').append(miniatureDisplay(emails[i]));
  }

  localStorage.setItem('loaded', upto - 1);
}

function archiveEmail(email) {
  // Await the fetch to assure the archiving process is completed by
  // the time we update the mailbox
  fetch(`/emails/${email.id}`, {
    method: 'PUT',
    body: JSON.stringify({
        // Alternate emails situation: if archived, unarchive, and vice versa
        archived: !email.archived
    })
  })
}

// Loading new emails when page end is reached
window.onscroll = () => {
  if(window.innerHeight + window.scrollY >= document.body.offsetHeight) {
      // document.querySelector('body').style.background = 'green';
      displayEmails(current_mailbox, parseInt(localStorage.getItem('loaded')) + 1, parseInt(localStorage.getItem('loaded')) + 1  + LOAD_CHUNK);
  } else {
    // document.querySelector('body').style.background = 'white';
  }
}