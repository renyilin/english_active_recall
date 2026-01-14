from fastapi.testclient import TestClient


def test_create_card(client: TestClient, auth_headers: dict):
    """Test creating a new card."""
    card_data = {
        "type": "phrase",
        "target_text": "call it a day",
        "target_meaning": "收工；今天就做到这里",
        "context_sentence": "I'm really tired, let's call it a day.",
        "context_translation": "我很累了，咱们收工吧。",
        "cloze_sentence": "I'm really tired, let's _______.",
    }
    response = client.post("/api/v1/cards", json=card_data, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["target_text"] == card_data["target_text"]
    assert data["type"] == "phrase"
    assert "id" in data
    assert "user_id" in data


def test_create_card_unauthorized(client: TestClient):
    """Test creating a card without auth fails."""
    card_data = {
        "type": "phrase",
        "target_text": "test",
        "target_meaning": "测试",
        "context_sentence": "This is a test.",
        "context_translation": "这是一个测试。",
        "cloze_sentence": "This is a _______.",
    }
    response = client.post("/api/v1/cards", json=card_data)
    assert response.status_code == 401


def test_list_cards(client: TestClient, auth_headers: dict):
    """Test listing cards."""
    # Create a card first
    card_data = {
        "type": "sentence",
        "target_text": "The quick brown fox",
        "target_meaning": "敏捷的棕色狐狸",
        "context_sentence": "The quick brown fox jumps over the lazy dog.",
        "context_translation": "敏捷的棕色狐狸跳过懒狗。",
        "cloze_sentence": "_______ jumps over the lazy dog.",
    }
    client.post("/api/v1/cards", json=card_data, headers=auth_headers)

    # List cards
    response = client.get("/api/v1/cards", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "page_size" in data
    assert len(data["items"]) >= 1


def test_list_cards_with_type_filter(client: TestClient, auth_headers: dict):
    """Test listing cards with type filter."""
    # Create cards of different types
    phrase_card = {
        "type": "phrase",
        "target_text": "break a leg",
        "target_meaning": "祝好运",
        "context_sentence": "Break a leg on your presentation!",
        "context_translation": "祝你演讲顺利！",
        "cloze_sentence": "_______ on your presentation!",
    }
    client.post("/api/v1/cards", json=phrase_card, headers=auth_headers)

    # Filter by phrase type
    response = client.get("/api/v1/cards?card_type=phrase", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    for item in data["items"]:
        assert item["type"] == "phrase"


def test_get_card(client: TestClient, auth_headers: dict):
    """Test getting a specific card."""
    # Create a card
    card_data = {
        "type": "phrase",
        "target_text": "piece of cake",
        "target_meaning": "小菜一碟",
        "context_sentence": "This test is a piece of cake.",
        "context_translation": "这个测试小菜一碟。",
        "cloze_sentence": "This test is a _______.",
    }
    create_response = client.post("/api/v1/cards", json=card_data, headers=auth_headers)
    card_id = create_response.json()["id"]

    # Get the card
    response = client.get(f"/api/v1/cards/{card_id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == card_id
    assert data["target_text"] == card_data["target_text"]


def test_get_card_not_found(client: TestClient, auth_headers: dict):
    """Test getting a non-existent card."""
    fake_id = "00000000-0000-0000-0000-000000000000"
    response = client.get(f"/api/v1/cards/{fake_id}", headers=auth_headers)
    assert response.status_code == 404


def test_update_card(client: TestClient, auth_headers: dict):
    """Test updating a card."""
    # Create a card
    card_data = {
        "type": "phrase",
        "target_text": "hit the road",
        "target_meaning": "出发",
        "context_sentence": "Let's hit the road.",
        "context_translation": "让我们出发吧。",
        "cloze_sentence": "Let's _______.",
    }
    create_response = client.post("/api/v1/cards", json=card_data, headers=auth_headers)
    card_id = create_response.json()["id"]

    # Update the card
    update_data = {"target_meaning": "上路；出发"}
    response = client.patch(f"/api/v1/cards/{card_id}", json=update_data, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["target_meaning"] == "上路；出发"
    assert data["target_text"] == card_data["target_text"]  # Unchanged


def test_delete_card(client: TestClient, auth_headers: dict):
    """Test deleting a card."""
    # Create a card
    card_data = {
        "type": "phrase",
        "target_text": "under the weather",
        "target_meaning": "身体不舒服",
        "context_sentence": "I'm feeling under the weather today.",
        "context_translation": "我今天感觉不舒服。",
        "cloze_sentence": "I'm feeling _______ today.",
    }
    create_response = client.post("/api/v1/cards", json=card_data, headers=auth_headers)
    card_id = create_response.json()["id"]

    # Delete the card
    response = client.delete(f"/api/v1/cards/{card_id}", headers=auth_headers)
    assert response.status_code == 204

    # Verify it's deleted
    get_response = client.get(f"/api/v1/cards/{card_id}", headers=auth_headers)
    assert get_response.status_code == 404


def test_get_due_cards(client: TestClient, auth_headers: dict):
    """Test getting cards due for review."""
    # Create a card (will be due immediately)
    card_data = {
        "type": "phrase",
        "target_text": "on the same page",
        "target_meaning": "意见一致",
        "context_sentence": "Let's make sure we're on the same page.",
        "context_translation": "让我们确保意见一致。",
        "cloze_sentence": "Let's make sure we're _______.",
    }
    client.post("/api/v1/cards", json=card_data, headers=auth_headers)

    # Get due cards
    response = client.get("/api/v1/cards/due", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


def test_review_card_easy(client: TestClient, auth_headers: dict):
    """Test reviewing a card with easy rating."""
    # Create a card
    card_data = {
        "type": "phrase",
        "target_text": "spill the beans",
        "target_meaning": "泄露秘密",
        "context_sentence": "Don't spill the beans about the surprise party.",
        "context_translation": "不要泄露惊喜派对的秘密。",
        "cloze_sentence": "Don't _______ about the surprise party.",
    }
    create_response = client.post("/api/v1/cards", json=card_data, headers=auth_headers)
    card_id = create_response.json()["id"]
    original_interval = create_response.json()["interval"]

    # Review with easy rating
    response = client.post(
        f"/api/v1/cards/{card_id}/review",
        json={"rating": "easy"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["interval"] >= original_interval  # Interval should increase


def test_review_card_hard(client: TestClient, auth_headers: dict):
    """Test reviewing a card with hard rating."""
    card_data = {
        "type": "phrase",
        "target_text": "bite the bullet",
        "target_meaning": "硬着头皮做",
        "context_sentence": "Sometimes you just have to bite the bullet.",
        "context_translation": "有时候你只能硬着头皮做。",
        "cloze_sentence": "Sometimes you just have to _______.",
    }
    create_response = client.post("/api/v1/cards", json=card_data, headers=auth_headers)
    card_id = create_response.json()["id"]

    # Review with hard rating
    response = client.post(
        f"/api/v1/cards/{card_id}/review",
        json={"rating": "hard"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["interval"] >= 1  # Should have some interval


def test_review_card_forgot(client: TestClient, auth_headers: dict):
    """Test reviewing a card with forgot rating."""
    card_data = {
        "type": "phrase",
        "target_text": "cost an arm and a leg",
        "target_meaning": "非常昂贵",
        "context_sentence": "That car cost an arm and a leg.",
        "context_translation": "那辆车贵得要命。",
        "cloze_sentence": "That car _______.",
    }
    create_response = client.post("/api/v1/cards", json=card_data, headers=auth_headers)
    card_id = create_response.json()["id"]

    # Review with forgot rating
    response = client.post(
        f"/api/v1/cards/{card_id}/review",
        json={"rating": "forgot"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["interval"] == 0  # Interval should reset


def test_review_card_not_found(client: TestClient, auth_headers: dict):
    """Test reviewing a non-existent card."""
    fake_id = "00000000-0000-0000-0000-000000000000"
    response = client.post(
        f"/api/v1/cards/{fake_id}/review",
        json={"rating": "easy"},
        headers=auth_headers,
    )
    assert response.status_code == 404


def test_review_card_remembered(client: TestClient, auth_headers: dict):
    """Test reviewing a card with remembered rating (new naming)."""
    card_data = {
        "type": "phrase",
        "target_text": "once in a blue moon",
        "target_meaning": "千载难逢",
        "context_sentence": "We only meet once in a blue moon.",
        "context_translation": "我们很少见面。",
        "cloze_sentence": "We only meet _______.",
    }
    create_response = client.post("/api/v1/cards", json=card_data, headers=auth_headers)
    card_id = create_response.json()["id"]
    original_interval = create_response.json()["interval"]

    # Review with remembered rating
    response = client.post(
        f"/api/v1/cards/{card_id}/review",
        json={"rating": "remembered"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["interval"] >= original_interval  # Interval should increase


def test_get_study_cards_hardest_strategy(client: TestClient, auth_headers: dict):
    """Test getting study cards with hardest strategy."""
    # Create multiple cards
    for i in range(3):
        card_data = {
            "type": "phrase",
            "target_text": f"test phrase {i}",
            "target_meaning": f"测试短语 {i}",
            "context_sentence": f"This is test phrase {i}.",
            "context_translation": f"这是测试短语 {i}。",
            "cloze_sentence": f"This is _______.",
        }
        client.post("/api/v1/cards", json=card_data, headers=auth_headers)

    # Get study cards with hardest strategy
    response = client.get(
        "/api/v1/cards/study?limit=10&strategy=hardest",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 3


def test_get_study_cards_random_strategy(client: TestClient, auth_headers: dict):
    """Test getting study cards with random strategy."""
    # Create multiple cards
    for i in range(5):
        card_data = {
            "type": "phrase",
            "target_text": f"random phrase {i}",
            "target_meaning": f"随机短语 {i}",
            "context_sentence": f"This is random phrase {i}.",
            "context_translation": f"这是随机短语 {i}。",
            "cloze_sentence": f"This is _______.",
        }
        client.post("/api/v1/cards", json=card_data, headers=auth_headers)

    # Get study cards with random strategy
    response = client.get(
        "/api/v1/cards/study?limit=5&strategy=random",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 5


def test_get_study_cards_requires_auth(client: TestClient):
    """Test that study endpoint requires authentication."""
    response = client.get("/api/v1/cards/study")
    assert response.status_code == 401


def test_get_study_cards_invalid_strategy(client: TestClient, auth_headers: dict):
    """Test getting study cards with invalid strategy returns validation error."""
    response = client.get(
        "/api/v1/cards/study?strategy=invalid",
        headers=auth_headers,
    )
    assert response.status_code == 422  # Validation error


def test_get_study_cards_with_limit(client: TestClient, auth_headers: dict):
    """Test that study endpoint respects limit parameter."""
    # Create multiple cards
    for i in range(10):
        card_data = {
            "type": "phrase",
            "target_text": f"limit test {i}",
            "target_meaning": f"限制测试 {i}",
            "context_sentence": f"Limit test {i}.",
            "context_translation": f"限制测试 {i}。",
            "cloze_sentence": "Limit test _______.",
        }
        client.post("/api/v1/cards", json=card_data, headers=auth_headers)

    # Request only 3 cards
    response = client.get(
        "/api/v1/cards/study?limit=3&strategy=hardest",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) <= 3
