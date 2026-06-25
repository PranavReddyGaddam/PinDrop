"""End-to-end tests for the Pindrop drop-pricing flow against in-memory SQLite."""

from __future__ import annotations

import datetime as dt
import uuid

from app.models import Campaign, CampaignControl, Commitment, PriceTier, User


def _make_campaign(session_factory, batch_cap=100, seeded_commits=9):
    """Create a campaign with the demo's 4 tiers and `seeded_commits` active buyers."""
    with session_factory() as db:
        seller = User(name="Blue Bottle", email="seller@bb.com")
        db.add(seller)
        db.flush()

        now = dt.datetime.now(dt.timezone.utc)
        campaign = Campaign(
            seller_id=seller.id,
            title="Yirgacheffe #47",
            batch_cap=batch_cap,
            opens_at=now,
            closes_at=now + dt.timedelta(hours=2),
            status="open",
        )
        db.add(campaign)
        db.flush()

        db.add_all(
            [
                PriceTier(campaign_id=campaign.id, min_quantity=1, unit_price=50.00),
                PriceTier(campaign_id=campaign.id, min_quantity=10, unit_price=42.00),
                PriceTier(campaign_id=campaign.id, min_quantity=25, unit_price=35.00),
                PriceTier(campaign_id=campaign.id, min_quantity=50, unit_price=29.00),
            ]
        )
        control = CampaignControl(campaign_id=campaign.id, reserved_count=seeded_commits)
        db.add(control)

        for i in range(seeded_commits):
            buyer = User(name=f"Buyer {i}", email=f"b{i}@x.com")
            db.add(buyer)
            db.flush()
            db.add(
                Commitment(
                    campaign_id=campaign.id, user_id=buyer.id, quantity=1, status="active"
                )
            )
        db.commit()
        return campaign.id


def test_stats_at_nine_committed(client, session_factory):
    cid = _make_campaign(session_factory, seeded_commits=9)
    r = client.get(f"/api/campaigns/{cid}")
    assert r.status_code == 200
    body = r.json()
    assert body["current_count"] == 9
    assert body["current_price"] == 50.0
    assert body["next_tier_at"] == 10
    assert body["next_tier_price"] == 42.0
    assert body["reserved_count"] == 9


def test_one_commit_triggers_price_drop(client, session_factory):
    cid = _make_campaign(session_factory, seeded_commits=9)

    r = client.post(
        f"/api/campaigns/{cid}/commit",
        json={"user_id": str(uuid.uuid4()), "quantity": 1},
    )
    assert r.status_code == 200, r.text
    assert r.json()["authorized_unit_price"] == 50.0  # authorized at the price-at-commit

    # After the 10th commit, price drops to $42 for everyone.
    stats = client.get(f"/api/campaigns/{cid}").json()
    assert stats["current_count"] == 10
    assert stats["current_price"] == 42.0
    assert stats["reserved_count"] == 10


def test_cap_guard_never_oversells(client, session_factory):
    # Cap 10, seed 9 -> exactly one unit left. Fire several commits; only one succeeds.
    cid = _make_campaign(session_factory, batch_cap=10, seeded_commits=9)

    results = [
        client.post(
            f"/api/campaigns/{cid}/commit",
            json={"user_id": str(uuid.uuid4()), "quantity": 1},
        ).status_code
        for _ in range(5)
    ]
    assert results.count(200) == 1
    assert results.count(409) == 4  # BATCH_FULL

    stats = client.get(f"/api/campaigns/{cid}").json()
    assert stats["reserved_count"] == 10
    assert stats["current_count"] == 10


def test_quantity_commit_respects_cap(client, session_factory):
    # Cap 12, seed 9 -> 3 left. A commit of quantity 5 must be rejected.
    cid = _make_campaign(session_factory, batch_cap=12, seeded_commits=9)
    r = client.post(
        f"/api/campaigns/{cid}/commit",
        json={"user_id": str(uuid.uuid4()), "quantity": 5},
    )
    assert r.status_code == 409
    # A commit of quantity 3 fits exactly.
    r2 = client.post(
        f"/api/campaigns/{cid}/commit",
        json={"user_id": str(uuid.uuid4()), "quantity": 3},
    )
    assert r2.status_code == 200, r2.text
    assert client.get(f"/api/campaigns/{cid}").json()["reserved_count"] == 12


def test_settlement_charges_final_price(client, session_factory):
    # Seed 24 -> price $35 tier not yet reached (25). Commit one more -> 25 -> $35.
    cid = _make_campaign(session_factory, seeded_commits=24)
    client.post(
        f"/api/campaigns/{cid}/commit",
        json={"user_id": str(uuid.uuid4()), "quantity": 1},
    )
    stats = client.get(f"/api/campaigns/{cid}").json()
    assert stats["current_count"] == 25
    assert stats["current_price"] == 35.0

    r = client.post(f"/api/campaigns/{cid}/settle")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["final_price"] == 35.0
    assert body["settled"] == 25

    # Campaign now settled; an order row exists per commitment at the final price.
    with session_factory() as db:
        from app.models import Order

        orders = db.query(Order).filter(Order.campaign_id == cid).all()
        assert len(orders) == 25
        assert all(float(o.final_unit_price) == 35.0 for o in orders)
        campaign = db.get(Campaign, cid)
        assert campaign.status == "settled"


def test_commit_rejected_when_closed(client, session_factory):
    cid = _make_campaign(session_factory, seeded_commits=9)
    # Force-close by settling first.
    client.post(f"/api/campaigns/{cid}/settle")
    r = client.post(
        f"/api/campaigns/{cid}/commit",
        json={"user_id": str(uuid.uuid4()), "quantity": 1},
    )
    assert r.status_code == 400


def test_list_campaigns_returns_open_only(client, session_factory):
    open_id = _make_campaign(session_factory, seeded_commits=1)
    settled_id = _make_campaign(session_factory, seeded_commits=1)
    client.post(f"/api/campaigns/{settled_id}/settle")

    listed = {c["campaign"]["id"] for c in client.get("/api/campaigns").json()}
    assert str(open_id) in listed
    assert str(settled_id) not in listed
