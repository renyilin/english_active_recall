import csv
from io import BytesIO, StringIO


HEADERS = [
    "Type",
    "Word/Phrase",
    "Meaning",
    "Context Sentence",
    "Context Translation",
    "Cloze Sentence",
    "Tags",
    "Interval (days)",
    "Ease Factor",
    "Next Review",
    "Created At",
]


class ExportService:
    """Service to export cards to CSV format."""

    def cards_to_csv(self, cards: list) -> BytesIO:
        """Convert a list of Card objects to a CSV file in memory."""
        csv_buffer = StringIO(newline="")
        writer = csv.writer(csv_buffer)

        writer.writerow(HEADERS)

        for card in cards:
            tags_str = ", ".join(tag.name for tag in card.tags)
            writer.writerow([
                card.type,
                card.target_text,
                card.target_meaning,
                card.context_sentence,
                card.context_translation,
                card.cloze_sentence,
                tags_str,
                card.interval,
                card.ease_factor,
                card.next_review.strftime("%Y-%m-%d %H:%M"),
                card.created_at.strftime("%Y-%m-%d %H:%M"),
            ])

        return BytesIO(csv_buffer.getvalue().encode("utf-8-sig"))
