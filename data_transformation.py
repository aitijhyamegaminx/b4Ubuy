import pandas as pd

input_path = "/Users/aitijhya/Desktop/Encode/openfoodfacts_extracted.csv"   # output from previous step
output_path = "/Users/aitijhya/Desktop/Encode/openfoodfacts_final.csv"

df = pd.read_csv(input_path, low_memory=False)

# 1. Drop rows where product_name_en is empty / NaN
df = df.dropna(subset=["product_name_en"])
df = df[df["product_name_en"].astype(str).str.strip() != ""]

# 2. Create allergen flags from allergens_tags and traces_tags
#    We will treat presence in either column as "has_* = 1", else 0
allergen_cols = ["allergens_tags", "traces_tags"]
for col in allergen_cols:
    if col not in df.columns:
        df[col] = ""

def has_tag(row, tag):
    """Check if given allergen tag appears in allergens or traces."""
    val = (str(row["allergens_tags"]) + " " + str(row["traces_tags"])).lower()
    return int(tag in val)

df["has_gluten"] = df.apply(lambda r: has_tag(r, "en:gluten"), axis=1)
df["has_milk"] = df.apply(lambda r: has_tag(r, "en:milk"), axis=1)
df["has_soybeans"] = df.apply(lambda r: has_tag(r, "en:soybeans"), axis=1)
df["has_nuts"] = df.apply(lambda r: has_tag(r, "en:nuts"), axis=1)
df["has_mustards"] = df.apply(lambda r: has_tag(r, "en:mustard"), axis=1)
# peanuts / groundnuts
df["has_peanuts"] = df.apply(
    lambda r: 1 if ("en:peanuts" in (str(r["allergens_tags"]) + " " + str(r["traces_tags"])).lower()
                    or "en:groundnuts" in (str(r["allergens_tags"]) + " " + str(r["traces_tags"])).lower())
    else 0,
    axis=1,
)
df["has_sulphur-dioxide-and-sulphites"] = df.apply(
    lambda r: has_tag(r, "en:sulphur-dioxide-and-sulphites"), axis=1
)
df["has_sesame-seeds"] = df.apply(lambda r: has_tag(r, "en:sesame-seeds"), axis=1)

# Drop original allergens/traces tag columns
df = df.drop(columns=["allergens_tags", "traces_tags"], errors="ignore")
df = df.drop(columns=["salt_value", "salt_unit"], errors="ignore")

# 3. Normalize salt, sodium, cholesterol to mg and drop unit columns
#    - If unit is 'g', multiply value by 1000
#    - If already in 'mg', keep as is
#    After this, units are assumed to be mg and unit columns are removed.

def to_mg(value, unit):
    try:
        v = float(value)
    except (TypeError, ValueError):
        return value  # leave as is if not numeric
    if isinstance(unit, str):
        u = unit.strip().lower()
    else:
        u = ""
    if u == "g":
        return v * 1000.0
    # if u is 'mg' or empty/other, leave unchanged
    return v

for nutrient, unit_col in [
    ("sodium_value", "sodium_unit"),
    ("cholesterol_value", "cholesterol_unit"),
]:
    if nutrient in df.columns:
        if unit_col in df.columns:
            df[nutrient] = df.apply(
                lambda r: to_mg(r[nutrient], r[unit_col]), axis=1
            )
        # After conversion, treat values as mg; drop the unit column
        if unit_col in df.columns:
            df = df.drop(columns=[unit_col])

# Save final structured CSV
df.to_csv(output_path, index=False)
print(f"Saved final structured file to {output_path}")



