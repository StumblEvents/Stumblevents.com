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

function renderCategory(name) {
  ...
}

Object.keys(categories).forEach((name, index) => {
  ...
});

renderCategory("Local Food");

function handleSignup(formId, noteId) {
  ...
}

handleSignup("heroSignup", "heroNote");
handleSignup("footerSignup", "footerNote");
