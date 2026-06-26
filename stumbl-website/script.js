const categories = {
  "Local Food": ["Hidden Gems", "Food Trucks", "Farmers Markets", "Mexican", "Brazilian", "Brunch", "Bakery / Coffee"],
  Dancing: ["Country Swing", "Ballroom", "Salsa", "Bachata", "Cumbia", "Line Dancing", "Swing Dancing"],
  Party: ["Birthday", "Watch Party", "Game Night", "Cookout / BBQ", "Bonfire", "Meetup / Social"],
  "Sports & Games": ["Play Basketball", "Play Pickleball", "Play Volleyball", "Watch Football", "Watch UFC / Boxing", "Board Games"],
  "Outdoor Activities": ["Trails & Greenways", "Hiking", "Biking", "Camping", "Dog Parks", "Kayaking / Canoeing"],
  "Outdoor Wellness": ["Yoga", "Pilates", "Meditation", "Breathwork", "Outdoor Fitness"],
  "Arts, Crafts & Hobbies": ["Painting", "Pottery / Ceramics", "Photography", "Book Clubs", "Gardening"],
  "Large Attendance": ["Festivals", "Parades", "Carnivals and Fairs", "Markets", "Cultural Events"],
  Weddings: ["Ceremony", "Reception", "Rehearsal Dinner", "Bachelor Party", "Bachelorette Party", "Vow Renewal"],
  Volunteer: ["Food Drive", "Blood Drive", "Community Cleanup", "Animal Shelter Volunteering", "Charity Fundraiser"]
};

const tabs = document.querySelector("#categoryTabs");
const title = document.querySelector("#categoryTitle");
const list = document.querySelector("#subcategoryList");

function renderCategory(name) {
  title.textContent = name;
  list.innerHTML = "";
  categories[name].forEach((subcategory) => {
    const pill = document.createElement("span");
    pill.textContent = subcategory;
    list.appendChild(pill);
  });

  [...tabs.querySelectorAll("button")].forEach((button) => {
    button.classList.toggle("active", button.textContent === name);
  });
}

Object.keys(categories).forEach((name, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = name;
  button.addEventListener("click", () => renderCategory(name));
  if (index === 0) button.classList.add("active");
  tabs.appendChild(button);
});

renderCategory("Local Food");

function handleSignup(formId, noteId) {
  const form = document.querySelector(`#${formId}`);
  const note = document.querySelector(`#${noteId}`);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = form.querySelector("input").value.trim();
    if (!email) return;
    const saved = JSON.parse(localStorage.getItem("stumblWaitlist") || "[]");
    if (!saved.includes(email)) saved.push(email);
    localStorage.setItem("stumblWaitlist", JSON.stringify(saved));
    note.textContent = "You're on the list. We'll let you know when Stumbl is ready.";
    form.reset();
  });
}

handleSignup("heroSignup", "heroNote");
handleSignup("footerSignup", "footerNote");
