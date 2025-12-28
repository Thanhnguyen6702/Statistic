"""
Stats service - Business logic for statistics calculations.
"""

from app.models import Expense


class StatsService:
    """Service class for statistics operations."""

    @staticmethod
    def get_overall_stats():
        """Get overall statistics (total, count, average)."""
        expenses = Expense.query.all()

        if not expenses:
            return {'total_amount': 0, 'total_count': 0, 'average_amount': 0}

        total = sum(exp.amount for exp in expenses)
        count = len(expenses)
        average = total / count if count > 0 else 0

        return {
            'total_amount': total,
            'total_count': count,
            'average_amount': round(average, 2)
        }

    @staticmethod
    def get_people_stats():
        """Get statistics per person with balance calculations."""
        expenses = Expense.query.all()

        if not expenses:
            return []

        # Get all unique member names
        all_members = set()
        for expense in expenses:
            all_members.add(expense.name)
            participants = expense.get_participants()
            if participants:
                for p in participants:
                    all_members.add(p)

        # Initialize stats for all members
        people_stats = {}
        for name in all_members:
            people_stats[name] = {
                'name': name,
                'total': 0,      # Total amount this person paid
                'count': 0,      # Number of payments made
                'share': 0,      # Total share this person owes
                'expenses': []
            }

        # Calculate stats
        for expense in expenses:
            exp_dict = expense.to_dict()
            name = expense.name

            # Add to payer's total
            people_stats[name]['total'] += expense.amount
            people_stats[name]['count'] += 1
            people_stats[name]['expenses'].append(exp_dict)

            # Calculate share: if participants is null, split among all members
            participants = expense.get_participants() or list(all_members)
            share_per_person = expense.amount / len(participants) if participants else 0

            for participant in participants:
                if participant in people_stats:
                    people_stats[participant]['share'] += share_per_person

        # Sort by total spending (descending)
        result = list(people_stats.values())
        result.sort(key=lambda x: x['total'], reverse=True)

        return result

    @staticmethod
    def get_person_stats(name):
        """Get statistics for a specific person."""
        expenses = Expense.query.filter_by(name=name).all()

        if not expenses:
            return None

        total = sum(exp.amount for exp in expenses)

        return {
            'name': name,
            'expenses': [exp.to_dict() for exp in expenses],
            'total': total,
            'count': len(expenses)
        }
