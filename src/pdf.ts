import fs from "fs";

const pdf: any = require("pdf-creator-node");

function getCardSize(card: any) {
  if (!("cardSize" in card)) {
    card.cardSize = calculateCardSize(card);
  }
  return card.cardSize;
}

function calculateCardSize(card: any) {
  let cardSize = 0;
  const newLinesWeight = 50;
  const newLinesCount = (card.description.match(/\n\n/g) || []).length;
  const descriptionLength =
    card.description.length +
    (newLinesCount + (card.attunement && card.attunement.length > 0 ? 2 : 0)) *
      newLinesWeight;
  if (descriptionLength > 1200) {
    cardSize = 3;
  } else if (descriptionLength > 650) {
    cardSize = 2;
  } else if (descriptionLength > 300) {
    cardSize = 1;
  }
  return cardSize;
}

function sortCards(cards: any[]) {
  const sortedCards = cards.sort((a, b) => getCardSize(b) - getCardSize(a));
  return sortedCards;
}

function batchCards(cards: any[]) {
  const extraLargeCards = cards.filter((card) => card.cardSize == 3);
  const largeCards = cards.filter((card) => card.cardSize == 2);
  const mediumCards = cards.filter((card) => card.cardSize == 1);
  const smallCards = cards.filter((card) => card.cardSize == 0);
  const batchedCards = [];
  while (extraLargeCards.length > 0) {
    batchedCards.push([extraLargeCards.pop()]);
  }
  while (largeCards.length > 0 && smallCards.length > 0) {
    batchedCards.push([largeCards.pop(), smallCards.pop()]);
  }
  while (mediumCards.length > 1) {
    batchedCards.push([mediumCards.pop(), mediumCards.pop()]);
  }
  while (mediumCards.length > 0 && smallCards.length > 1) {
    batchedCards.push([mediumCards.pop(), smallCards.pop(), smallCards.pop()]);
  }
  while (smallCards.length > 3) {
    batchedCards.push([
      smallCards.pop(),
      smallCards.pop(),
      smallCards.pop(),
      smallCards.pop(),
    ]);
  }

  while (largeCards.length > 0) {
    batchedCards.push([largeCards.pop()]);
  }

  if (mediumCards.length > 0 && smallCards.length > 0) {
    batchedCards.push([mediumCards.pop(), smallCards.pop()]);
  }

  while (mediumCards.length > 0) {
    batchedCards.push([mediumCards.pop()]);
  }

  if (smallCards.length > 0) {
    batchedCards.push(smallCards);
  }

  return batchedCards;
}

function createPdf(filename: string, cards: any[]) {
  const html = fs.readFileSync("item_card_template.html", "utf8");

  const options = {
    format: "A4",
    orientation: "landscape",
    border: "0",
    header: { height: "0", contents: null },
    footer: { height: "0", contents: null },
  };

  const document = {
    html,
    data: { batches: cards },
    path: `./${filename}.pdf`,
    type: "pdf",
  };

  pdf
    .create(document, options)
    .then((res: any) => {
      console.log(res);
    })
    .catch((error: Error) => {
      console.error(error);
    });
}

async function main() {
  if (process.argv.length > 2) {
    const filename = process.argv[2];

    fs.readFile(filename, "utf8", function (err, data) {
      if (err) throw err;
      const cards = JSON.parse(data);
      const sortedCards = sortCards(cards);
      const batchedCards = batchCards(sortedCards);
      createPdf(filename.replace(/\.[^/.]+$/, ""), batchedCards);
    });
  } else {
    throw new Error("filename required");
  }
}

main();
