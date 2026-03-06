def calculate_cost(labor_hours, labor_rate, equipment_hours, equipment_rate):
    return (labor_hours * labor_rate) + (equipment_hours * equipment_rate)

def calculate_revenue(qty_done, boq_rate):
    return qty_done * boq_rate

def calculate_margin(revenue, cost):
    return revenue - cost
