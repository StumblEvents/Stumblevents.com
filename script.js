const categories = {
  "Local Food": {
    "Hidden Gems": [
      "Mexican",
      "American / Burgers",
      "BBQ",
      "Italian",
      "Asian",
      "Korean",
      "Chinese",
      "Japanese",
      "Brazilian",
      "Breakfast",
      "Brunch",
      "Bakery / Coffee",
      "Dessert",
      "Other"
    ],
    "Food Trucks": [
      "Mexican",
      "BBQ",
      "Burgers",
      "Tacos",
      "Asian",
      "Wings",
      "Seafood",
      "Desserts",
      "Coffee / Drinks",
      "Other"
    ],
    "Farmers Markets": [],
    "Grand Openings": [],
    "Other": []
  },

  Dancing: [
    "Country Swing",
    "Ballroom",
    "Salsa",
    "Bachata",
    "Cumbia",
    "Line Dancing",
    "Square Dancing",
    "Swing Dancing",
    "Other"
  ],

  Party: [
    "Birthday",
    "Reunion",
    "Ice Cream Social",
    "Watch Party",
    "Game Night",
    "Cookout / BBQ",
    "Bonfire",
    "Meetup / Social",
    "Other"
  ],

  "Sports & Games": {
    Play: [
      "Basketball",
      "Football",
      "Soccer",
      "Baseball",
      "Softball",
      "Tennis",
      "Pickleball",
      "Volleyball",
      "Disc Golf",
      "Ultimate Frisbee",
      "Ping Pong",
      "Cornhole",
      "Card Games",
      "Board Games",
      "Other"
    ],
    Watch: [
      "Basketball",
      "Football",
      "Soccer",
      "Baseball",
      "Softball",
      "Tennis",
      "Pickleball",
      "Volleyball",
      "Golf",
      "UFC / Boxing",
      "Racing",
      "Other"
    ]
  },

  "Outdoor Activities": {
    "Trails & Greenways": [],
    Hiking: [],
    Biking: [],
    Fishing: [],
    "Kayaking / Canoeing": [],
    Camping: ["Campouts", "Camp Sites"],
    "Rock Climbing": [],
    "Dog-Friendly Activities": {
      "Dog Parks": [],
      "Dog Shows": ["Dog Meetups"],
      "Adoption Events": [],
      "Pet-Friendly Markets": [],
      "Training Classes": [],
      Other: []
    },
    "Outdoor Wellness": [
      "Yoga",
      "Pilates",
      "Meditation",
      "Breathwork",
      "Outdoor Fitness",
      "Wellness Workshop",
      "Other"
    ],
    Other: []
  },

  "Arts, Crafts & Hobbies": [
    "Quilting",
    "Sewing",
    "Knitting / Crochet",
    "Painting",
    "Pottery / Ceramics",
    "Woodworking",
    "Photography",
    "Book Clubs",
    "Writing Groups",
    "Gardening",
    "Drone flying",
    "Kite flying",
    "RCX racing",
    "Other"
  ],

  "Education & Career": {
    "Career & Recruiting": [
      "Job Fair",
      "Internship Fairs",
      "Employer Info Sessions",
      "Networking Events",
      "Recruiting Luncheon",
      "Resume Workshops",
      "Interview Prep",
      "Career Panels",
      "Other"
    ],
    "Devotionals & Forums": [
      "Guest speaker",
      "Campus Devotional",
      "Fireside",
      "Forum",
      "Speaker Series",
      "Other"
    ],
    "Academic Events": [
      "Guest Lectures",
      "Department Events",
      "Research Presentations",
      "Symposiums",
      "Conferences",
      "Major Fairs",
      "Other"
    ],
    "Workshops & Skill Building": [
      "Financial Literacy",
      "Tax / Accounting",
      "Coding / Tech",
      "Public Speaking",
      "Leadership",
      "Writing",
      "Study Skills",
      "Certifications / Training",
      "Other"
    ],
    "Study & Tutoring": [
      "Study Groups",
      "Exam Review",
      "Tutoring",
      "Homework Help",
      "Other"
    ],
    "Business & Entrepreneurship": [
      "Startup Events",
      "Pitch Competitions",
      "Business Workshops",
      "Founder Meetups",
      "Other"
    ],
    "Admissions & Info Sessions": [
      "Graduate School Info Sessions",
      "Program Info Sessions",
      "Transfer Student Events",
      "Orientation",
      "Other"
    ],
    Other: []
  },

  "Large Attendance": {
    Festivals: [],
    Parades: [],
    "Carnivals and Fairs": [],
    Markets: [],
    Community: [],
    "Cultural Events": [
      "African",
      "African American",
      "American",
      "Brazilian",
      "Caribbean",
      "Chinese",
      "Filipino",
      "French",
      "German",
      "Greek",
      "Indian",
      "Irish",
      "Italian",
      "Japanese",
      "Korean",
      "Mexican",
      "Middle Eastern",
      "Native American",
      "Pacific Islander",
      "Puerto Rican",
      "Scottish",
      "Vietnamese",
      "Other"
    ]
  },

  Weddings: [
    "Ceremony",
    "Reception",
    "Rehearsal Dinner",
    "Bachelor Party",
    "Bachelorette Party",
    "Bridal Showers",
    "Vow Renewal",
    "Other"
  ],

  Volunteer: [
    "Food Drive",
    "Blood Drive",
    "Clothing Drive",
    "Toy Drive",
    "School Supply Drive",
    "Community Cleanup",
    "Park Cleanup",
    "Roadside Cleanup",
    "Animal Shelter Volunteering",
    "Soup Kitchen/Meal service",
    "Homeless Outreach",
    "Senior Care/Nursing Home Visits",
    "Youth Mentoring",
    "Charity Fundraiser",
    "Disaster Relief",
    "Habitat/Home Repair",
    "Other"
  ]
};

const tabs = document.querySelector("#categoryTabs");
const title = document.querySelector("#categoryTitle");
const list = document.querySelector("#subcategoryList");

let currentPath = ["Local Food"];
let selectedPath = null;

function getNodeFromPath(path) {
  return path.reduce((node, key) => {
    if (!node || Array.isArray(node)) return null;
    return node[key];
  }, categories);
}

function hasChildren(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return false;
}

function createCategoryButton(label, path, value) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "category-option";
  button.textContent = label;

  const buttonPath = [...path, label];
  const isSelected =
    selectedPath && selectedPath.join(" > ") === buttonPath.join(" > ");

  if (isSelected) {
    button.classList.add("selected");
  }

  if (hasChildren(value)) {
    button.classList.add("has-children");

    button.addEventListener("click", () => {
      currentPath = buttonPath;
      selectedPath = null;
      renderCurrentPath();
    });
  } else {
    button.classList.add("final-option");

    button.addEventListener("click", () => {
      selectedPath = buttonPath;
      renderCurrentPath();
    });
  }

  return button;
}

function createBreadcrumb() {
  const breadcrumb = document.createElement("div");
  breadcrumb.className = "category-breadcrumb";

  currentPath.forEach((part, index) => {
    const crumb = document.createElement("button");
    crumb.type = "button";
    crumb.textContent = part;

    crumb.addEventListener("click", () => {
      currentPath = currentPath.slice(0, index + 1);
      selectedPath = null;
      renderCurrentPath();
    });

    breadcrumb.appendChild(crumb);

    if (index < currentPath.length - 1) {
      const divider = document.createElement("span");
      divider.textContent = "›";
      breadcrumb.appendChild(divider);
    }
  });

  return breadcrumb;
}

function renderCurrentPath() {
  const currentCategory = currentPath[0];
  const currentName = currentPath[currentPath.length - 1];
  const currentNode = getNodeFromPath(currentPath);

  title.textContent = currentName;
  list.innerHTML = "";

  list.appendChild(createBreadcrumb());

  const optionsWrapper = document.createElement("div");
  optionsWrapper.className = "category-options";

  if (Array.isArray(currentNode)) {
    currentNode.forEach((item) => {
      optionsWrapper.appendChild(createCategoryButton(item, currentPath, null));
    });
  } else if (currentNode && typeof currentNode === "object") {
    Object.entries(currentNode).forEach(([name, value]) => {
      optionsWrapper.appendChild(
        createCategoryButton(name, currentPath, value)
      );
    });
  }

  list.appendChild(optionsWrapper);

  if (selectedPath) {
    const selectedNote = document.createElement("p");
    selectedNote.className = "selected-category-note";
    selectedNote.textContent = `Selected: ${selectedPath.join(" > ")}`;
    list.appendChild(selectedNote);
  }

  [...tabs.querySelectorAll("button")].forEach((button) => {
    button.classList.toggle("active", button.textContent === currentCategory);
  });
}

Object.keys(categories).forEach((name, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = name;

  button.addEventListener("click", () => {
    currentPath = [name];
    selectedPath = null;
    renderCurrentPath();
  });

  if (index === 0) button.classList.add("active");

  tabs.appendChild(button);
});

renderCurrentPath();

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

      note.textContent =
        "You're on the list. We'll let you know when Stumbl is ready.";
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
