"""
GameRoomService - Business logic for game room operations.
"""

import json
from datetime import datetime
from app.extensions import db
from app.models import GameRoom, GameRound, GameMatch
from app.services.user_service import UserService


class GameRoomService:
    """Service class for game room operations."""

    VALID_CHOICES = {'rock', 'paper', 'scissors'}
    CHOICE_BEATS = {
        'rock': 'scissors',
        'paper': 'rock',
        'scissors': 'paper'
    }

    @staticmethod
    def create_room(host_id, best_of=3):
        """Create a new game room."""
        room = GameRoom(
            room_code=GameRoom.generate_room_code(),
            host_id=host_id,
            best_of=best_of
        )
        db.session.add(room)
        db.session.commit()
        return room

    @staticmethod
    def join_room(room_code, guest_id):
        """Join an existing room."""
        room = GameRoom.query.filter_by(room_code=room_code.upper()).first()

        if not room:
            raise ValueError('Không tìm thấy phòng')
        if room.status != 'waiting':
            raise ValueError('Phòng không khả dụng')
        if room.host_id == guest_id:
            raise ValueError('Không thể tham gia phòng của chính mình')
        if room.is_full:
            raise ValueError('Phòng đã đầy')

        room.guest_id = guest_id
        room.status = 'playing'
        db.session.commit()

        # Create first round
        GameRoomService.create_round(room.id)

        return room

    @staticmethod
    def leave_room(room_id, user_id):
        """Leave a room (forfeit if game in progress)."""
        room = GameRoom.query.get(room_id)
        if not room:
            return

        if room.status == 'playing':
            # Forfeit - other player wins
            if user_id == room.host_id:
                winner_id = room.guest_id
            else:
                winner_id = room.host_id

            if winner_id:
                GameRoomService.end_match(room, winner_id)

        # Delete room if host leaves or game not started
        if room.status == 'waiting' or user_id == room.host_id:
            db.session.delete(room)
        else:
            room.guest_id = None
            room.status = 'waiting'

        db.session.commit()

    @staticmethod
    def create_round(room_id):
        """Create a new round in the room."""
        room = GameRoom.query.get(room_id)
        if not room:
            return None

        room.current_round += 1
        round_obj = GameRound(
            room_id=room_id,
            round_number=room.current_round
        )
        db.session.add(round_obj)
        db.session.commit()
        return round_obj

    @staticmethod
    def get_current_round(room_id):
        """Get the current active round for a room."""
        room = GameRoom.query.get(room_id)
        if not room:
            return None

        return GameRound.query.filter_by(
            room_id=room_id,
            round_number=room.current_round
        ).first()

    @staticmethod
    def make_choice(room_id, user_id, choice):
        """Player makes a choice for current round."""
        choice = choice.lower()
        if choice not in GameRoomService.VALID_CHOICES:
            raise ValueError('Lựa chọn không hợp lệ')

        room = GameRoom.query.get(room_id)
        if not room or room.status != 'playing':
            raise ValueError('Trò chơi chưa bắt đầu')

        # Get current round
        current_round = GameRound.query.filter_by(
            room_id=room_id,
            round_number=room.current_round
        ).first()

        if not current_round:
            raise ValueError('Không có lượt đang hoạt động')

        # Set choice
        is_host = user_id == room.host_id
        if is_host:
            if current_round.host_choice:
                raise ValueError('Bạn đã chọn rồi')
            current_round.host_choice = choice
        else:
            if current_round.guest_choice:
                raise ValueError('Bạn đã chọn rồi')
            current_round.guest_choice = choice

        db.session.commit()

        # Check if round is complete
        if current_round.host_choice and current_round.guest_choice:
            return GameRoomService.resolve_round(room, current_round)

        return {'status': 'waiting', 'round': current_round.to_dict()}

    @staticmethod
    def resolve_round(room, round_obj):
        """Resolve a round and determine winner."""
        host_choice = round_obj.host_choice
        guest_choice = round_obj.guest_choice

        if host_choice == guest_choice:
            round_obj.result = 'draw'
        elif GameRoomService.CHOICE_BEATS[host_choice] == guest_choice:
            round_obj.result = 'host'
            room.host_score += 1
        else:
            round_obj.result = 'guest'
            room.guest_score += 1

        round_obj.completed_at = datetime.utcnow()
        db.session.commit()

        # Check if match is over
        wins_needed = (room.best_of // 2) + 1
        if room.host_score >= wins_needed:
            return GameRoomService.end_match(room, room.host_id)
        elif room.guest_score >= wins_needed:
            return GameRoomService.end_match(room, room.guest_id)

        # Create next round
        GameRoomService.create_round(room.id)

        return {
            'status': 'round_complete',
            'round': round_obj.to_dict(reveal=True),
            'room': room.to_dict()
        }

    @staticmethod
    def end_match(room, winner_id):
        """End the match and save to history."""
        room.status = 'finished'

        # Collect round data
        rounds_data = []
        for r in room.rounds.order_by(GameRound.round_number):
            rounds_data.append(r.to_dict(reveal=True))

        # Create match record
        match = GameMatch(
            player1_id=room.host_id,
            player2_id=room.guest_id,
            winner_id=winner_id,
            player1_score=room.host_score,
            player2_score=room.guest_score,
            rounds_data=json.dumps(rounds_data),
            started_at=room.created_at
        )
        db.session.add(match)

        # Update user stats
        if winner_id == room.host_id:
            UserService.update_stats(room.host_id, 'win')
            UserService.update_stats(room.guest_id, 'loss')
        else:
            UserService.update_stats(room.guest_id, 'win')
            UserService.update_stats(room.host_id, 'loss')

        db.session.commit()

        return {
            'status': 'match_complete',
            'winner_id': winner_id,
            'room': room.to_dict(),
            'match_id': match.id
        }

    @staticmethod
    def get_room_by_code(room_code):
        return GameRoom.query.filter_by(room_code=room_code.upper()).first()

    @staticmethod
    def get_room_by_id(room_id):
        return GameRoom.query.get(room_id)

    @staticmethod
    def get_user_match_history(user_id, limit=20):
        """Get match history for a user."""
        from sqlalchemy import or_
        return GameMatch.query.filter(
            or_(
                GameMatch.player1_id == user_id,
                GameMatch.player2_id == user_id
            )
        ).order_by(GameMatch.ended_at.desc()).limit(limit).all()
