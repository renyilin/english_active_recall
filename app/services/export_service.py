from io import BytesIO

from openpyxl import Workbook


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
    """Service to export cards to XLSX format."""

    def cards_to_xlsx(self, cards: list) -> BytesIO:
        """Convert a list of Card objects to an XLSX file in memory."""
        wb = Workbook()
        ws = wb.active
        ws.title = "Cards"

        ws.append(HEADERS)

        for card in cards:
            tags_str = ", ".join(tag.name for tag in card.tags)
            ws.append([
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

        buf = BytesIO()
        wb.save(buf)
        buf.seek(0)
        return buf
