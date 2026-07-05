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

let selectedCategory = "Local Food";
let selectedSubcategory = null;
let selectedSubSubcategory = null;

function getChildren(node) {
  if (Array.isArray(node)) {
    return node.map((item) => ({
      name: item,
      value: null
    }));
  }

  if (node && typeof node === "object") {
    return Object.entries(node).map(([name, value]) => ({
      name,
      value
    }));
  }

  return [];
}

function hasChildren(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return false;
}

function createTabButton(text, isActive, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;

  if (isActive) {
    button.classList.add("active");
  }

  button.addEventListener("click", onClick);

  return button;
}

function createTabSection(labelText) {
  const section = document.createElement("div");
  section.className = "category-tab-section";

  const label = document.createElement("p");
  label.className = "category-tab-label";
  label.textContent = labelText;

  const row = document.createElement("div");
  row.className = "category-tab-row";

  section.appendChild(label);
  section.appendChild(row);

  return { section, row };
}

function renderMainCategories() {
  tabs.innerHTML = "";

  Object.keys(categories).forEach((categoryName) => {
    const button = createTabButton(
      categoryName,
      categoryName === selectedCategory,
      () => {
        selectedCategory = categoryName;
        selectedSubcategory = null;
        selectedSubSubcategory = null;
        renderCategories();
      }
    );

    tabs.appendChild(button);
  });
}

function renderCategories() {
  renderMainCategories();

  title.textContent = selectedCategory;
  list.innerHTML = "";

  const selectedCategoryData = categories[selectedCategory];

  const subcategorySection = createTabSection("Subcategory");
  const subcategories = getChildren(selectedCategoryData);

  subcategories.forEach(({ name, value }) => {
    const button = createTabButton(
      name,
      name === selectedSubcategory,
      () => {
        selectedSubcategory = name;
        selectedSubSubcategory = null;
        renderCategories();
      }
    );

    if (hasChildren(value)) {
      button.classList.add("has-children");
    }

    subcategorySection.row.appendChild(button);
  });

  list.appendChild(subcategorySection.section);

  if (!selectedSubcategory && subcategories.length > 0) {
    selectedSubcategory = subcategories[0].name;
  }

  const selectedSubcategoryData = Array.isArray(selectedCategoryData)
    ? null
    : selectedCategoryData[selectedSubcategory];

  if (hasChildren(selectedSubcategoryData)) {
    const nextLevelSection = createTabSection("Next Level");
    const nextLevelItems = getChildren(selectedSubcategoryData);

    nextLevelItems.forEach(({ name, value }) => {
      const button = createTabButton(
        name,
        name === selectedSubSubcategory,
        () => {
          selectedSubSubcategory = name;
          renderCategories();
        }
      );

      if (hasChildren(value)) {
        button.classList.add("has-children");
      }

      nextLevelSection.row.appendChild(button);
    });

    list.appendChild(nextLevelSection.section);

    if (selectedSubSubcategory) {
      const deeperData = selectedSubcategoryData[selectedSubSubcategory];

      if (hasChildren(deeperData)) {
        const deeperSection = createTabSection("More Options");
        const deeperItems = getChildren(deeperData);

        deeperItems.forEach(({ name }) => {
          const button = createTabButton(name, false, () => {
            selectedSubSubcategory = name;
            renderCategories();
          });

          deeperSection.row.appendChild(button);
        });

        list.appendChild(deeperSection.section);
      }
    }
  }

  const selectedPath = [selectedCategory];

  if (selectedSubcategory) {
    selectedPath.push(selectedSubcategory);
  }

  if (selectedSubSubcategory) {
    selectedPath.push(selectedSubSubcategory);
  }

  const pathNote = document.createElement("p");
  pathNote.className = "selected-category-note";
  pathNote.textContent = `Selected: ${selectedPath.join(" › ")}`;
  list.appendChild(pathNote);
}

renderCategories();

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
