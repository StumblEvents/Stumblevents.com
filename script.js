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
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = form.querySelector('input[type="email"]').value.trim();
    if (!email) return;

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    note.classList.remove("is-error");
    note.textContent = "Joining...";

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) throw new Error("Signup failed");

      note.textContent = "You're on the list. We'll let you know when Stumbl is ready.";
      form.reset();
    } catch {
      note.classList.add("is-error");
      note.textContent = "We couldn't add you just yet. Please try again.";
    } finally {
      button.disabled = false;
    }
  });
}

handleSignup("heroSignup", "heroNote");
handleSignup("footerSignup", "footerNote");
