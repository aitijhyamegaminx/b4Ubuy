import pandas as pd

# ---- CONFIG ----
input_path = "/Users/aitijhya/Desktop/Encode/openfoodfacts_export.tsv"   # your input file (Excel or CSV)
output_path = "/Users/aitijhya/Desktop/Encode/openfoodfacts_extracted.csv" # desired output CSV

# If your file is actually an Excel (.xlsx), use:
# df = pd.read_excel(input_path)

# For the provided OpenFoodFacts export CSV:
df = pd.read_csv(input_path, sep="\t", low_memory=False)

# Columns to keep
cols_to_keep = [
    "product_name_en",
    "brands",
    "quantity",
    "categories",
    "labels",
    "ingredients_text_en",
    "allergens_tags",
    "traces_tags",
    "energy-kcal_value",
    "fat_value",
    "saturated-fat_value",
    "carbohydrates_value",
    "sugars_value",
    "fiber_value",
    "proteins_value",
    "salt_value",
    "salt_unit",
    "sodium_value",
    "sodium_unit",
    "monounsaturated-fat_value",
    "polyunsaturated-fat_value",
    "trans-fat_value",
    "cholesterol_value",
    "cholesterol_unit",
    "added-sugars_value",
    "off:food_groups_tags",
    "off:nova_groups",
    "off:nutriscore_grade",
]

# Keep only the intersection of requested columns and existing columns
existing_cols = [c for c in cols_to_keep if c in df.columns]

# Optionally, warn about missing columns
missing_cols = [c for c in cols_to_keep if c not in df.columns]
if missing_cols:
    print("Warning: these columns were not found in the input and will be omitted:")
    for c in missing_cols:
        print(" -", c)

# Subset and write to CSV
df_out = df[existing_cols]
df_out.to_csv(output_path, index=False)
print(f"Saved {len(df_out)} rows with {len(existing_cols)} columns to {output_path}")
