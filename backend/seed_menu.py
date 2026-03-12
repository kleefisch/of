"""Seed menu categories and items. Run: python seed_menu.py"""
from dotenv import load_dotenv
load_dotenv()

from app import create_app
from app.extensions import db
from app.models.menu_category import MenuCategory
from app.models.menu_item import MenuItem

CATEGORIES = ["Starters", "Burgers", "Mains", "Pasta", "Salads", "Desserts", "Drinks"]

# loremflickr.com: reliable demo images — same image for same keyword+lock
_F = "https://loremflickr.com/400/400"

ITEMS = [
    # (name, description, price, category, image_url)
    ("Garlic Bread",        "Toasted ciabatta with garlic butter",             5.50,  "Starters",  _F+"/garlic,bread/all?lock=10"),
    ("Bruschetta",          "Tomato, basil and mozzarella on toast",           7.00,  "Starters",  _F+"/bruschetta,tomato/all?lock=11"),
    ("Chicken Wings",       "Crispy wings with BBQ or buffalo sauce",          9.50,  "Starters",  _F+"/chicken,wings/all?lock=12"),
    ("Calamari",            "Fried squid rings with aioli dip",                8.50,  "Starters",  _F+"/calamari,seafood/all?lock=13"),
    ("Classic Burger",      "Beef patty, lettuce, tomato, pickles",           13.50,  "Burgers",   _F+"/hamburger,burger/all?lock=20"),
    ("Cheese Burger",       "Classic with cheddar and caramelised onion",     14.50,  "Burgers",   _F+"/cheeseburger,burger/all?lock=21"),
    ("BBQ Bacon Burger",    "Smoked bacon, BBQ sauce, crispy onion rings",    16.00,  "Burgers",   _F+"/bacon,burger/all?lock=22"),
    ("Veggie Burger",       "Black bean patty with avocado and salsa",        13.00,  "Burgers",   _F+"/veggie,burger/all?lock=23"),
    ("Grilled Salmon",      "Atlantic salmon with lemon butter and greens",   22.00,  "Mains",     _F+"/salmon,grilled/all?lock=30"),
    ("Chicken Schnitzel",   "Crumbed chicken breast with chips and salad",    19.50,  "Mains",     _F+"/schnitzel,chicken/all?lock=31"),
    ("Beef Steak 250g",     "Sirloin with chips, greens and pepper sauce",    32.00,  "Mains",     _F+"/steak,beef/all?lock=32"),
    ("Lamb Chops",          "Herb-marinated lamb with roasted vegetables",    28.00,  "Mains",     _F+"/lamb,chops/all?lock=33"),
    ("Spaghetti Bolognese", "Slow-cooked beef ragu with parmesan",            17.00,  "Pasta",     _F+"/spaghetti,bolognese/all?lock=40"),
    ("Fettuccine Alfredo",  "Creamy parmesan sauce with fresh pasta",         16.00,  "Pasta",     _F+"/fettuccine,pasta/all?lock=41"),
    ("Penne Arrabbiata",    "Spicy tomato and garlic sauce, vegan",           15.50,  "Pasta",     _F+"/penne,pasta/all?lock=42"),
    ("Lobster Ravioli",     "Homemade ravioli in creamy bisque sauce",        24.00,  "Pasta",     _F+"/ravioli,pasta/all?lock=43"),
    ("Caesar Salad",        "Cos lettuce, croutons, parmesan, anchovy",       14.00,  "Salads",    _F+"/caesar,salad/all?lock=50"),
    ("Greek Salad",         "Tomato, cucumber, olives, feta, oregano",        12.00,  "Salads",    _F+"/greek,salad/all?lock=51"),
    ("Warm Beef Salad",     "Sliced steak over rocket with balsamic",         18.00,  "Salads",    _F+"/beef,salad/all?lock=52"),
    ("Chocolate Lava Cake", "Warm chocolate cake with vanilla ice cream",      9.00,  "Desserts",  _F+"/chocolate,cake/all?lock=60"),
    ("Tiramisu",            "Classic Italian coffee dessert",                  8.50,  "Desserts",  _F+"/tiramisu,dessert/all?lock=61"),
    ("Cheesecake",          "New York style with berry compote",               8.00,  "Desserts",  _F+"/cheesecake,dessert/all?lock=62"),
    ("Soft Drink",          "Coke, Sprite, Fanta or water",                   4.00,  "Drinks",    _F+"/cola,soda/all?lock=70"),
    ("Fresh Juice",         "Orange, apple or mixed berry",                   5.50,  "Drinks",    _F+"/juice,orange/all?lock=71"),
    ("Sparkling Water",     "500ml San Pellegrino",                            4.50,  "Drinks",    _F+"/water,sparkling/all?lock=72"),
    ("House Wine",          "Red or white by the glass, ask your waiter",    10.00,  "Drinks",    _F+"/wine,glass/all?lock=73"),
    ("Craft Beer",          "Selection of local craft beers on tap",           8.00,  "Drinks",    _F+"/beer,craft/all?lock=74"),
]

app = create_app("development")

with app.app_context():
    # Ensure categories exist
    cat_map = {}
    for name in CATEGORIES:
        cat = MenuCategory.query.filter_by(name=name).first()
        if not cat:
            cat = MenuCategory(name=name, is_active=True)
            db.session.add(cat)
            db.session.flush()
            print(f"  + Category: {name}")
        else:
            print(f"  = Category exists: {name}")
        cat_map[name] = cat

    # Create or update items
    for name, desc, price, cat_name, img in ITEMS:
        existing = MenuItem.query.filter_by(name=name).first()
        if existing:
            existing.image_url = img
            print(f"    ~ Updated image: {name}")
        else:
            db.session.add(MenuItem(
                name=name,
                description=desc,
                price=price,
                category_id=cat_map[cat_name].id,
                is_available=True,
                is_active=True,
                image_url=img,
            ))
            print(f"    + Item: {name} (${price})")

    db.session.commit()
    total = MenuItem.query.count()
    print(f"\nDone. Total items in DB: {total}")
