import { Client } from "@notionhq/client";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const getProperty = async (notion: Client, page: any, propertyName: string) => {
  const propertyId = page.properties[propertyName].id;

  const property = (await notion.pages.properties.retrieve({
    page_id: page.id,
    property_id: propertyId,
  })) as any;

  let propertyValue = property[property.type];

  if ("Rarity" == propertyName || "Type" == propertyName) {
    if (property[property.type] && "name" in property[property.type])
      propertyValue = property[property.type].name;
  } else if (
    "Attunement" == propertyName ||
    "Description" == propertyName ||
    "Description (Identified)" == propertyName ||
    "Description (Exalted)" == propertyName
  ) {
    if (property.results.length > 0) {
      propertyValue = property.results
        .map((result: any) => result.rich_text.text.content)
        .join("");
    } else propertyValue = null;
  } else if ("Name" == propertyName) {
    propertyValue = property.results
      .map((result: any) => result.title.text.content)
      .join("");
  } else if ("Number" == propertyName) {
    propertyValue = String(propertyValue).padStart(6, "0");
  }

  return propertyValue;
};

const getItemCardValues = async (notion: Client, itemPageId: any) => {
  const itemPage = await notion.pages.retrieve({ page_id: itemPageId });

  const number = await getProperty(notion, itemPage, "Number");
  const name = await getProperty(notion, itemPage, "Name");
  const attunement = await getProperty(notion, itemPage, "Attunement");
  const type = await getProperty(notion, itemPage, "Type");
  const rarity = await getProperty(notion, itemPage, "Rarity");
  const description = await getProperty(notion, itemPage, "Description");
  const descriptionIdentified = await getProperty(
    notion,
    itemPage,
    "Description (Identified)"
  );
  const descriptionExalted = await getProperty(
    notion,
    itemPage,
    "Description (Exalted)"
  );

  const itemCards = [{ number, name, attunement, type, rarity, description }];

  if (descriptionIdentified) {
    const itemCardIdentified = { ...itemCards[0] };
    itemCardIdentified.description += "\n\n" + descriptionIdentified;
    itemCards.push(itemCardIdentified);
  }

  if (descriptionExalted) {
    const itemCardExalted = { ...itemCards[0] };
    itemCardExalted.name = itemCardExalted.name + " (Exalted)";
    if (descriptionIdentified) {
      itemCardExalted.description += "\n\n" + descriptionIdentified;
    }
    itemCardExalted.description += "\n\n" + descriptionExalted;
    itemCards.push(itemCardExalted);
  }

  return itemCards;
};

const getItemCards = async (notion: Client, page: any) => {
  const itemId = page.properties.Items.id;

  const itemPages = (
    (await notion.pages.properties.retrieve({
      page_id: page.id,
      property_id: itemId,
    })) as any
  ).results;

  const itemCards = await Promise.all(
    itemPages.map(
      async (itemPage: any) =>
        await getItemCardValues(notion, itemPage.relation.id)
    )
  );

  return itemCards;
};

const getItems = async (notion: Client, itemPages: any[]) => {
  const items = [] as any[];
  for (const itemPageIndex in itemPages) {
    const itemPage = itemPages[itemPageIndex];
    const itemCardCount = await getProperty(notion, itemPage, "Count");
    const itemCards = await getItemCards(notion, itemPage);
    const itemCardsIncludingDuplicates = itemCards.reduce(
      (res, current) => res.concat(...Array(itemCardCount).fill(current)),
      []
    );

    items.push(...itemCardsIncludingDuplicates);
  }

  return items;
};

async function main() {
  const notion = new Client({ auth: process.env.NOTION_TOKEN });

  const items = (
    await notion.databases.query({
      database_id: process.env.DATABASE_ID!,
      filter: { property: "Print", checkbox: { equals: true } },
    })
  ).results;

  const itemCards = await getItems(notion, items);

  const filename = `item_cards_${new Date().toJSON().slice(0, 10)}.json`;

  fs.writeFile(filename, JSON.stringify(itemCards, null, 4), (error) => {
    if (error) throw error;
    console.log(`${itemCards.length} item cards saved in ${filename}`);
  });
}

main();
