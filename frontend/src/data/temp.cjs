const fs = require("fs");

// load your JSON file
const data = JSON.parse(fs.readFileSync("usernames.json", "utf-8"));

// helper function to find longest word
function findLongest(arr) {
  return arr.reduce((longest, current) => {
    return current.length > longest.length ? current : longest;
  }, "");
}

const longestAdjective = findLongest(data.adjectives);
const longestNoun = findLongest(data.nouns);

console.log("Longest adjective:", longestAdjective);
console.log("Length:", longestAdjective.length);

console.log("Longest noun:", longestNoun);
console.log("Length:", longestNoun.length);