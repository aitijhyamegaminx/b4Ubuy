import pandas as pd
import numpy as np


# ---------- CONFIG ----------
INPUT_PATH = "openfoodfacts_final.csv"       # your current transformed file
OUTPUT_PATH = "openfoodfacts_categorized.csv"


# ---------- LOAD ----------
df = pd.read_csv(INPUT_PATH, low_memory=False)


# ---------- PREP: preserve original index ----------
df = df.reset_index().rename(columns={"index": "orig_idx"})


# ---------- STEP 1: normalise + explode categories ----------
def split_categories(cat_str: str):
    if pd.isna(cat_str):
        return []
    return [p.strip() for p in str(cat_str).split(",") if p.strip() != ""]


df["categories_norm"] = df["categories"].fillna("").astype(str).apply(split_categories)
df_exploded = df.explode("categories_norm").copy()
df_exploded["categories_norm"] = (
    df_exploded["categories_norm"].astype(str).str.strip()
)
df_exploded = df_exploded[df_exploded["categories_norm"] != ""]


# ---------- STEP 2: pick leaf category ----------
leaf_series = df_exploded["categories_norm"]


# ---------- STEP 3: primary mapping rules ----------
MAPPING = {
    "Chips and fries": ("Snacks", "Chips, Wafers & Crisps"),
    "Fries": ("Snacks", "Chips, Wafers & Crisps"),
    "Frozen fries": ("Snacks", "Chips, Wafers & Crisps"),

    "Beverages": ("Beverages", "Soft Drinks & Sodas"),
    "Beverages and beverages preparations": ("Beverages", "Soft Drinks & Sodas"),

    "Condiments": ("Condiments", "Sauces & Ketchup"),

    "Snacks": ("Snacks", "Fried Snacks & Namkeen"),
    "Sweet snacks": ("Sweets & Confectionery", "Biscuits & Cookies"),
    "Biscuits and cakes": ("Sweets & Confectionery", "Biscuits & Cookies"),
    "Biscuits": ("Sweets & Confectionery", "Biscuits & Cookies"),
    "Biscuits and crackers": ("Sweets & Confectionery", "Biscuits & Cookies"),

    "Breakfast cereals": ("Staples & Grains", "Breakfast Cereals & Muesli"),
    "Mueslis": ("Staples & Grains", "Breakfast Cereals & Muesli"),
    "Mueslis, Bircher-style mueslis": ("Staples & Grains", "Breakfast Cereals & Muesli"),

    "Papadum": ("Bakery", "Breads & Flatbreads"),

    "Protein powders": ("Health & Nutrition", "Protein Powders & Shakes"),
    "Dietary supplements": ("Health & Nutrition", "Dietary Supplements"),
    "Bodybuilding supplements": ("Health & Nutrition", "Dietary Supplements"),

    "Dairies": ("Dairy", "Milk & Milk Variants"),
    "Fermented milk products": ("Dairy", "Yogurt & Fermented Dairy"),
    "Cheeses": ("Dairy", "Cheese & Paneer"),
    "Sliced cheeses": ("Dairy", "Cheese & Paneer"),

    "Vanilla milkshake": ("Beverages", "Milk-Based Beverages"),

    "Cereal flakes": ("Staples & Grains", "Breakfast Cereals & Muesli"),
    "Breakfasts": ("Staples & Grains", "Breakfast Cereals & Muesli"),
    "Cereals and their products": ("Staples & Grains", "Breakfast Cereals & Muesli"),
    "Breads": ("Bakery", "Breads & Flatbreads"),
    "Flatbreads": ("Bakery", "Breads & Flatbreads"),
    "Special breads": ("Bakery", "Breads & Flatbreads"),
    "Spice Mix": ("Spices & Herbs", "Masalas & Blends"),
    "Spices": ("Spices & Herbs", "Masalas & Blends"),
    "Herbs and spices": ("Spices & Herbs", "Masalas & Blends"),
    "Legumes and their products": ("Pulses & Legumes", "Lentils & Dals"),
    "Legume butters": ("Nuts & Seeds", "Nut Butters & Pastes"),
    "Peanut butters": ("Nuts & Seeds", "Nut Butters & Pastes"),
    "Canned fruits": ("Fruits", "Dried Fruits"),
    "Pineapple in syrup": ("Fruits", "Fruit Preserves & Jams"),
}


def map_leaf_to_tuple(leaf: str) -> str:
    leaf = leaf.strip()
    if not leaf:
        return np.nan
    if leaf in MAPPING:
        cat, subcat = MAPPING[leaf]
        return f"{cat}, {subcat}"
    low = leaf.lower()
    if "biscuit" in low or "cookie" in low:
        return "Sweets & Confectionery, Biscuits & Cookies"
    if "chips" in low or "wafers" in low or "crisps" in low:
        return "Snacks, Chips, Wafers & Crisps"
    if "cereal" in low or "muesli" in low or "corn flakes" in low:
        return "Staples & Grains, Breakfast Cereals & Muesli"
    if "milkshake" in low or "milk shake" in low:
        return "Beverages, Milk-Based Beverages"
    if "juice" in low or "nectar" in low:
        return "Beverages, Fruit-Based Beverages"
    if "pickle" in low or "chutney" in low:
        return "Condiments, Chutneys & Pickles"
    if "masala" in low or "spice mix" in low:
        return "Spices & Herbs, Masalas & Blends"
    if "dal" in low or "lentil" in low:
        return "Pulses & Legumes, Lentils & Dals"
    return np.nan


df_exploded["cat_subcat"] = leaf_series.apply(map_leaf_to_tuple)


# ---------- STEP 4: collapse back ----------
df_mapped = (
    df_exploded
    .dropna(subset=["cat_subcat"])
    .groupby("orig_idx")["cat_subcat"]
    .first()
)

df = df.set_index("orig_idx")
df["category_subcategory"] = df_mapped


# ---------- STEP 5: fallback mapping on full category list ----------
cat_lists = (
    df_exploded
    .groupby("orig_idx")["categories_norm"]
    .apply(list)
)
df["categories_norm"] = cat_lists


def fallback_map(cat_list):
    if not isinstance(cat_list, list) or not cat_list:
        return np.nan

    text = " | ".join(cat_list).lower()
    leaf = cat_list[-1].lower()

    if "instant noodles" in text:
        return "Staples & Grains, Noodles & Vermicelli"
    if "instant noodle soups" in text or "dehydrated asian-style soup with noodles" in text:
        return "Ready Foods, Rehydratable & Dried Meals"

    if "almonds" in text:
        return "Nuts & Seeds, Raw Nuts"
    if "cashew nuts" in text:
        return "Nuts & Seeds, Raw Nuts"
    if "unsalted cashews" in text or "roasted salted almonds and cashew" in text:
        return "Nuts & Seeds, Roasted & Salted Nuts"
    if "sunflower seeds" in text or "flax seeds" in text or "basil seeds" in text:
        return "Nuts & Seeds, Seeds & Seed Mixes"
    if "fox nuts" in text or "makhana" in text:
        return "Nuts & Seeds, Seeds & Seed Mixes"

    if "dried fruits" in text or "dried plant-based foods" in text:
        return "Fruits, Dried Fruits"
    if "raisins" in text or "dried apricots" in text or "dates" in text:
        return "Fruits, Dried Fruits"
    if "berries" in text or "blueberries" in text:
        return "Fruits, Dried Fruits"

    if "sunflower oils" in text or "ricebran oil" in text or "rice bran oil" in text:
        return "Oils & Fats, Vegetable Oils"
    if "mustard oils" in text:
        return "Oils & Fats, Seed & Nut Oils"
    if "palm oils" in text or "palm oil refined" in text:
        return "Oils & Fats, Vegetable Oils"
    if "ghee" in text or "clarified butter" in text or "butter fat" in text:
        return "Oils & Fats, Ghee & Butter"

    if "wheat vermicelli" in text or "vermicelli" in text:
        return "Staples & Grains, Noodles & Vermicelli"
    if "pastas" in text:
        return "Staples & Grains, Pasta & Macaroni"
    if "granulated wheat" in text or "semolina" in text or "suji" in text:
        return "Staples & Grains, Semolina & Rava"
    if "puffed rice blend" in text or "wheat puffs" in text:
        return "Staples & Grains, Rice & Rice Products"

    if "sweeteners" in text or "sugars" in text or "jaggery" in text:
        return "Ingredients, Sugars & Sweeteners"
    if "syrups" in text or "date syrups" in text:
        return "Ingredients, Sugars & Sweeteners"

    if "coriander powder" in text:
        return "Spices & Herbs, Ground Spices"
    if "spice mix" in text:
        return "Spices & Herbs, Masalas & Blends"

    if "curd" in text or "dahi" in text:
        return "Dairy, Yogurt & Fermented Dairy"
    if "mozzarella" in text or "cheese cubes" in text or "cheese balls" in text:
        return "Dairy, Cheese & Paneer"
    if "ice creams" in text or "icecream" in text or "ice cream bars" in text \
       or "ice cream cones" in text or "ice cream sandwiches" in text:
        return "Dairy, Dairy Desserts"

    if "ready-to-eat savouries" in text or "fried snacks" in text or "namkeen" in text:
        return "Snacks, Fried Snacks & Namkeen"
    if "popcorn" in text:
        return "Snacks, Popcorn & Fryums"

    if "ready to cook batter" in text or "batters" in text or "dosa batter" in text or "idly batter" in text:
        return "Ready Foods, Ready Batters – Idli/Dosa"
    if "soups" in text or "soup mixes" in text:
        return "Ready Foods, Rehydratable & Dried Meals"

    if "cocoa and chocolate powders" in text:
        return "Sweets & Confectionery, Chocolates"

    if "bières ipa" in text or "pale ales" in text or "ipa" in text:
        return "Alcoholic Beverages, Beer & Ales"

    if leaf.endswith("almonds"):
        return "Nuts & Seeds, Raw Nuts"
    if "seeds" in leaf:
        return "Nuts & Seeds, Seeds & Seed Mixes"
    if leaf in ("raisins", "dates", "apricots", "kiwis", "dried kiwis"):
        return "Fruits, Dried Fruits"
    if "noodles" in leaf:
        return "Staples & Grains, Noodles & Vermicelli"
    if "ghee" in leaf:
        return "Oils & Fats, Ghee & Butter"
    return np.nan


mask_unmapped = df["category_subcategory"].isna()
df.loc[mask_unmapped, "category_subcategory"] = df.loc[mask_unmapped, "categories_norm"].apply(fallback_map)


# ---------- STEP 6: final categories split + clean up ----------

# use mapped value
df["categories"] = df["category_subcategory"]

# drop helper column
df = df.drop(columns=["categories_norm", "category_subcategory"], errors="ignore")

# drop off:food_groups_tags if present
df = df.drop(columns=["off:food_groups_tags"], errors="ignore")

# drop rows where categories is still missing/empty
df["categories"] = df["categories"].astype(str)
df = df[df["categories"].notna() & (df["categories"].str.strip() != "nan") & (df["categories"].str.strip() != "")]

# split "Category, Subcategory" into two columns
def split_cat_subcat(s):
    parts = [p.strip() for p in str(s).split(",", 1)]
    if len(parts) == 2:
        return pd.Series({"category": parts[0], "subcategory": parts[1]})
    # if malformed, treat entire as category, subcategory empty
    return pd.Series({"category": parts[0], "subcategory": ""})

cat_sub_df = df["categories"].apply(split_cat_subcat)
df["category"] = cat_sub_df["category"]
df["subcategory"] = cat_sub_df["subcategory"]

# you can keep or drop the combined categories column; here we drop it
df = df.drop(columns=["categories"], errors="ignore")

# reset index
df = df.reset_index(drop=True)

# ---------- REORDER COLUMNS: put category & subcategory after quantity ----------
cols = list(df.columns)

if "quantity" in cols and "category" in cols and "subcategory" in cols:
    cols.remove("category")
    cols.remove("subcategory")
    q_idx = cols.index("quantity") + 1
    cols[q_idx:q_idx] = ["category", "subcategory"]
    df = df[cols]

df['product_name_en'] = df['product_name_en'].str.title()
df['brands'] = df['brands'].str.title()

# ---------- SAVE ----------
df.to_csv(OUTPUT_PATH, index=False)
print(f"Saved categorized file to {OUTPUT_PATH}")
