"""
Roleplay Companion — Prompt Templates per Generazione Contenuti
Usa MiniMax 2.7 per generare contenuti in tempo reale e post-sessione.
Tutti i prompt sono in italiano.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class CharacterContext:
    """Contesto del personaggio per i prompt."""
    name: str
    race: str
    character_class: str
    backstory: str
    personality_traits: str
    motivations: str
    dreams: str
    fears: str
    goals_long_term: str
    goals_short_term: str
    catchphrases: list[str]
    iconic_items: list[str]
    musical_talent: bool = False
    writing_talent: bool = False


# ============================================================================
# M3 — REAL-TIME SUGGESTIONS (Suggerimenti in tempo reale durante la sessione)
# ============================================================================

def build_realtime_suggestion_prompt(
    character: CharacterContext,
    recent_transcript: str,
    session_context: str,
) -> str:
    """
    Prompt per generare suggerimenti in tempo reale dal punto di vista del PG.
    Usato durante la sessione per suggerire azioni/momenti chiave.
    """
    return f"""Sei l'anima di {character.name}, un {character.race} {character.character_class}.
Il giocatore sta interpretando questo personaggio durante una sessione D&D su Google Meet.

=== PROFILO DEL PERSONAGGIO ===
Nome: {character.name}
Razza: {character.race}
Classe: {character.character_class}

Backstory: {character.backstory}

Tratti di personalità: {character.personality_traits}

Motivazioni: {character.motivations}

Sogni: {character.dreams}

Paure: {character.fears}

Obiettivi a lungo termine: {character.goals_long_term}

Obiettivi a breve termine: {character.goals_short_term}

Modi di dire caratteristici: {', '.join(character.catchphrases) if character.catchphrases else 'Nessuno ancora registrato'}

Oggetti iconici: {', '.join(character.iconic_items) if character.iconic_items else 'Nessuno ancora registrato'}

=== SESSIONE ATTUALE ===
Contesto della campagna: {session_context}

=== TRANSCRIPT RECENTE (ultimi messaggi) ===
{recent_transcript}

=== ISTRUZIONI ===
Analizza il transcript e identifica se c'è un momento rilevante per {character.name}.
Un momento è rilevante se:
- Il PG viene coinvolto in una decisione importante
- C'è tensione, combattimento o interazione con NPC
- Il PG potrebbe reagire in modo caratteristico basandosi sui suoi tratti
- Si presenta un'opportunità legata agli obiettivi del PG

Se NON c'è un momento rilevante, rispondi SOLO con:
NESSUN_MOMENTO

Se C'È un momento rilevante, rispondi con questo formato esatto:

MOMENTO_CHIAVE
Tipo: [decisione/combattimento/interazione_npc/opportunità/tensione]
Priorità: [high/medium/low]

{character.name} si fermerebbe qui. [Descrizione di cosa farebbe o direbbe il PG in questo momento, dal suo punto di vista. Usa i suoi tratti, motivazioni, paure e modi di dire per renderlo autentico. 2-4 frasi.]

Contesto: [Breve spiegazione di perché questo momento è significativo per il PG]

Lingua: italiano.
"""


def build_key_moment_detection_prompt(
    character: CharacterContext,
    full_transcript: str,
    session_context: str,
) -> str:
    """
    Prompt per identificare tutti i momenti chiave in un transcript completo.
    Usato dopo la sessione per analizzare l'intera sessione.
    """
    return f"""Analizza questa sessione di gioco D&D dal punto di vista del personaggio del giocatore.

=== PROFILO DEL PERSONAGGIO ===
Nome: {character.name}
Razza: {character.race}
Classe: {character.character_class}
Backstory: {character.backstory}
Tratti di personalità: {character.personality_traits}
Motivazioni: {character.motivations}
Sogni: {character.dreams}
Paure: {character.fears}
Obiettivi a lungo termine: {character.goals_long_term}
Obiettivi a breve termine: {character.goals_short_term}
Modi di dire: {', '.join(character.catchphrases) if character.catchphrases else 'Nessuno'}

=== CONTESTO DELLA CAMPAGNA ===
{session_context}

=== TRANSCRIPT COMPLETO DELLA SESSIONE ===
{full_transcript}

=== ISTRUZIONI ===
Identifica TUTTI i momenti chiave dove {character.name} era coinvolto o dove avrebbe potuto fare qualcosa di significativo.
Per ogni momento, restituisci:

MOMENTO|Numero: [N]
Estratto: [estratto rilevante dal transcript]
Cosa è successo: [breve descrizione]
Cosa farebbe {character.name}: [3-4 frasi su azione/reazione del PG basata sui suoi tratti]
Priorità: [high/medium/low]
Tipo: [decisione/combattimento/interazione_npc/opportunità/rivelazione/emozione]

Se non ci sono momenti rilevanti, rispondi:
NESSUN_MOMENTO_RILEVANTE

Lingua: italiano.
"""


# ============================================================================
# M4 — POST-SESSION CONTENT GENERATION
# ============================================================================

def build_journal_prompt(
    character: CharacterContext,
    session_title: str,
    session_events: str,
    key_moments: str,
) -> str:
    """
    Genera una entry del diario dal punto di vista del PG.
    Post-sessione, prima persona, stile diario.
    """
    return f"""Scrivi una entry del diario di {character.name} dopo questa sessione di gioco.

=== PROFILO DEL PERSONAGGIO ===
Nome: {character.name}
Razza: {character.race}
Classe: {character.character_class}
Backstory: {character.backstory}
Tratti di personalità: {character.personality_traits}
Motivazioni: {character.motivations}
Sogni: {character.dreams}
Paure: {character.fears}
Obiettivi a lungo termine: {character.goals_long_term}
Obiettivi a breve termine: {character.goals_short_term}
Modi di dire: {', '.join(character.catchphrases) if character.catchphrases else 'Nessuno'}

=== DETTAGLI DELLA SESSIONE ===
Titolo: {session_title}

Eventi principali: {session_events}

Momenti chiave identificati:
{key_moments}

=== ISTRUZIONI ===
Scrivi come se {character.name} stesse scrivendo nel suo diario la sera dopo l'avventura.
Stile:
- Prima persona
- Tone appropriato al personaggio (serio, ironico, malinconico, etc.)
- Include cosa è successo dal punto di vista del PG
- Come si sente il PG dopo gli eventi
- Cosa ha imparato o scoperto
- Cosa pianifica per il futuro
- Un momento personale o sentimentale
- Eventuali riferimenti ai suoi oggetti iconici o modi di dire

Lunghezza: 300-500 parole.
Lingua: italiano.
"""


def build_memory_prompt(
    character: CharacterContext,
    key_moment: str,
    pg_relevance: str,
) -> str:
    """
    Genera una memoria dal punto di vista del PG.
    Un momento che il PG ricorderà per sempre.
    """
    return f"""Crea una memoria indelebile che {character.name} conserverà per sempre.

=== PROFILO DEL PERSONAGGIO ===
Nome: {character.name}
Razza: {character.race}
Classe: {character.character_class}
Backstory: {character.backstory}
Tratti di personalità: {character.personality_traits}
Motivazioni: {character.motivations}
Sogni: {character.dreams}
Paure: {character.fears}

=== MOMENTO SCELTO ===
{key_moment}

Rilevanza per il PG: {pg_relevance}

=== ISTRUZIONI ===
Scrivi la memoria come se {character.name} la stesse fissando nella sua mente per l'eternità.
Stile:
- Prima persona, introspettivo
- Evocativo e sensoriale (cosa ha visto, sentito, provato)
- Lunghezza: 100-200 parole
- Il momento è impresso nella memoria del PG per sempre
- Può includere dettagli emotivi profondi
- Ritratta il momento dal punto di vista unico del PG

Lingua: italiano.
"""


def build_catchphrase_prompt(
    character: CharacterContext,
    recent_dialogue: str,
    context: str,
) -> str:
    """
    Estrae o genera un nuovo modo di dire/battuta iconica per il PG.
    """
    return f"""Analizza se {character.name} ha detto qualcosa di iconico durante questa sessione,
o genera un nuovo modo di dire che si adatti al suo personaggio.

=== PROFILO DEL PERSONAGGIO ===
Nome: {character.name}
Razza: {character.race}
Classe: {character.character_class}
Backstory: {character.backstory}
Tratti di personalità: {character.personality_traits}
Modi di dire esistenti: {', '.join(character.catchphrases) if character.catchphrases else 'Nessuno ancora'}

=== DIALOGHI RECENTI DEL PG ===
{recent_dialogue}

=== CONTESTO ===
{context}

=== ISTRUZIONI ===
Considera:
1. Se il PG ha già un modo di dire характернистico, puoi reiterarlo
2. Se c'è una nuova battuta/momento iconico, estraila e migliorala
3. Se non c'è nulla di memorabile, genera un nuovo modo di dire che {character.name}
   potrebbe usare in situazioni simili basandosi sui suoi tratti

Rispondi con uno solo dei seguenti formati:

Se estrai una battuta esistente:
BATTUTA_ESISTENTE: [la battuta]

Se crei una nuova battuta basata sul momento:
NUOVA_BATTUTA: [il modo di dire]
Contesto d'uso: [quando il PG lo direbbe]

Se il momento non merita una battuta:
NESSUNA_BATTUTA

Lingua: italiano.
"""


def build_song_prompt(
    character: CharacterContext,
    session_events: str,
    key_moments: str,
) -> str:
    """
    Genera una canzone/ballata dal punto di vista del PG.
    Solo per PG con musical_talent = True.
    """
    if not character.musical_talent:
        raise ValueError(f"{character.name} non ha talenti musicali")

    return f"""Scrivi una canzone che {character.name} potrebbe comporre dopo questa avventura.

=== PROFILO DEL PERSONAGGIO ===
Nome: {character.name}
Razza: {character.race}
Classe: {character.character_class}
Backstory: {character.backstory}
Tratti di personalità: {character.personality_traits}
Motivazioni: {character.motivations}
Sogni: {character.dreams}
Paure: {character.fears}

=== EVENTI DELLA SESSIONE ===
{session_events}

=== MOMENTI CHIAVE ===
{key_moments}

=== ISTRUZIONI ===
Scrivi una ballata medievale/fantasy dal punto di vista di {character.name}.
Formato:
- Titolo della canzone
- 3-4 strofe (ogni strofa 4 versi)
- Ritornello (da ripetere dopo ogni strofa)
- Accordi base per piano in formato semplice (es: Am - G - F - E)
- Il tono deve riflettere la personalità del PG e gli eventi vissuti
- Se il PG ha paure o sogni specifici, includi riferimenti

Lunghezza: appropriata per essere cantata (non troppo lunga).
Lingua: italiano.
"""


def build_poetry_prompt(
    character: CharacterContext,
    theme: str,
    context: str,
) -> str:
    """
    Genera una poesia dal punto di vista del PG.
    Alternativa alla canzone per PG con musical_talent.
    """
    return f"""Scrivi una poesia dal punto di vista di {character.name}.

=== PROFILO DEL PERSONAGGIO ===
Nome: {character.name}
Razza: {character.race}
Classe: {character.character_class}
Backstory: {character.backstory}
Tratti di personalità: {character.personality_traits}
Motivazioni: {character.motivations}
Sogni: {character.dreams}
Paure: {character.fears}

=== TEMA ===
{theme}

=== CONTESTO ===
{context}

=== ISTRUZIONI ===
Scrivi una poesia che rifletta {theme} dal punto di vista di {character.name}.
Stile:
- 8-16 versi totali
- Tono appropriato al personaggio e al tema
- Profondo e personale
- Eventuali riferimenti alla backstory, paure o sogni del PG

Lingua: italiano.
"""


def build_letter_prompt(
    character: CharacterContext,
    recipient: str,
    purpose: str,
    session_context: str,
) -> str:
    """
    Genera una lettera scritta dal PG.
    Solo per PG con writing_talent = True.
    """
    if not character.writing_talent:
        raise ValueError(f"{character.name} non ha talenti nella scrittura")

    return f"""Scrivi una lettera che {character.name} scriverebbe a {recipient}.

=== PROFILO DEL PERSONAGGIO ===
Nome: {character.name}
Razza: {character.race}
Classe: {character.character_class}
Backstory: {character.backstory}
Tratti di personalità: {character.personality_traits}
Motivazioni: {character.motivations}
Sogni: {character.dreams}
Paure: {character.fears}

=== DETTAGLI DELLA LETTERA ===
Destinatario: {recipient}
Scopo: {purpose}
Contesto della sessione: {session_context}

=== ISTRUZIONI ===
Scrivi una lettera formale in stile medievale/fantasy.
Formato:
- Invocazione/formula di apertura
- Corpo della lettera (motivazioni, novità, sentimenti)
- Chiusura e firma
- Tono appropriato alla relazione tra {character.name} e {recipient}
- Lunghezza: 200-400 parole

Lingua: italiano.
"""


def build_item_description_prompt(
    character: CharacterContext,
    item_name: str,
    item_origin: str,
    session_context: str,
) -> str:
    """
    Genera una descrizione dettagliata di un oggetto iconico.
    """
    return f"""Crea una descrizione ricca e dettagliata dell'oggetto '{item_name}' dal punto di vista di {character.name}.

=== PROFILO DEL PERSONAGGIO ===
Nome: {character.name}
Razza: {character.race}
Classe: {character.character_class}
Backstory: {character.backstory}
Tratti di personalità: {character.personality_traits}
Oggetti iconici esistenti: {', '.join(character.iconic_items) if character.iconic_items else 'Nessuno'}

=== DETTAGLI DELL'OGGETTO ===
Nome: {item_name}
Origine/Storia: {item_origin}
Contesto: {session_context}

=== ISTRUZIONI ===
Scrivi una descrizione evocativa dell'oggetto che {character.name} potrebbe aggiungere ai suoi oggetti iconici.
Formato:
- Nome dell'oggetto
- Descrizione fisica (aspetto, materiali, dettagli)
- Storia o aneddoto legato all'oggetto
- Significato personale per {character.name}
- Perché è iconico

Lunghezza: 150-300 parole.
Lingua: italiano.
"""


def build_note_prompt(
    character: CharacterContext,
    note_type: str,
    context: str,
) -> str:
    """
    Genera una nota/appunto dal punto di vista del PG.
    """
    return f"""Scrivi una nota che {character.name} potrebbe scrivere.

=== PROFILO DEL PERSONAGGIO ===
Nome: {character.name}
Razza: {character.race}
Classe: {character.character_class}
Backstory: {character.backstory}
Tratti di personalità: {character.personality_traits}
Obiettivi a lungo termine: {character.goals_long_term}
Obiettivi a breve termine: {character.goals_short_term}

=== TIPO DI NOTA ===
{note_type}

=== CONTESTO ===
{context}

=== ISTRUZIONI ===
Scrivi una nota breve e concisa.
Formato:
- Titolo (se appropriato)
- Contenuto della nota
- Stile: prima persona, pratico, caratteristico del PG

Lunghezza: 50-150 parole.
Lingua: italiano.
"""


# ============================================================================
# M5 — CHARACTER DEVELOPMENT UPDATES
# ============================================================================

def build_goals_update_prompt(
    character: CharacterContext,
    session_events: str,
    completed_objectives: str,
) -> str:
    """
    Suggerisce aggiornamenti agli obiettivi del PG basandosi sulla sessione.
    """
    return f"""Analizza questa sessione e suggerisci aggiornamenti agli obiettivi di {character.name}.

=== PROFILO ATTUALE ===
Obiettivi a lungo termine: {character.goals_long_term}
Obiettivi a breve termine: {character.goals_short_term}

=== EVENTI DELLA SESSIONE ===
{session_events}

=== OBIETTIVI COMPLETATI ===
{completed_objectives}

=== ISTRUZIONI ===
Basandoti sugli eventi, suggerisci:
1. Quali obiettivi sono stati completati (spiegando perché)
2. Quali nuovi obiettivi a breve termine sono emersi
3. Se un evento potrebbe influenzare gli obiettivi a lungo termine
4. Eventuali modifiche alle priorità

Formato la risposta come:

OBIETTIVI_COMPLETATI:
- [obiettivo]: [ragione]

NUOVI_OBBIETTIVI_BREVE:
- [nuovo obiettivo]

MODIFICHE_LUNGO_TERMINE:
- [eventuale modifica]

Lingua: italiano.
"""


def build_dreams_update_prompt(
    character: CharacterContext,
    recent_events: str,
    character_growth: str,
) -> str:
    """
    Suggerisce aggiornamenti ai sogni del PG.
    """
    return f"""Analizza se i sogni di {character.name} sono cambiati dopo questa sessione.

=== SOGNI ATTUALI ===
{character.dreams}

=== EVENTI RECENTI ===
{recent_events}

=== CRESCITA DEL PERSONAGGIO ===
{character_growth}

=== ISTRUZIONI ===
Considera se:
- Un sogno si è avverato (anche parzialmente)
- Un nuovo sogno è emerso
- Un sogno è diventato più vicino o più lontano
- Un evento ha cambiato la prospettiva del PG sui suoi sogni

Rispondi con:
SOGNI_INALTERATI: [se nessun cambiamento]

oppure

SOGNI_AGGIORNATI:
Sogno 1: [il sogno aggiornato]
Motivazione: [perché è cambiato]

Lingua: italiano.
"""


def build_fears_update_prompt(
    character: CharacterContext,
    recent_events: str,
    character_growth: str,
) -> str:
    """
    Suggerisce aggiornamenti alle paure del PG.
    """
    return f"""Analizza se le paure di {character.name} sono cambiate dopo questa sessione.

=== PAURE ATTUALI ===
{character.fears}

=== EVENTI RECENTI ===
{recent_events}

=== CRESCITA DEL PERSONAGGIO ===
{character_growth}

=== ISTRUZIONI ===
Considera se:
- Una paura si è manifestata o è stata superata
- Una nuova paura è emersa
- Il PG ha affrontato una paura (e come l'ha gestita)
- Un'esperienza ha modificato una paura esistente

Rispondi con:
PAURE_INALTERATE: [se nessun cambiamento]

oppure

PAURE_AGGIORNATE:
Paura 1: [la paura aggiornata]
Motivazione: [perché è cambiata]

Lingua: italiano.
"""


# ============================================================================
# CONSISTENCY CHECKER
# ============================================================================

def build_consistency_check_prompt(
    character: CharacterContext,
    new_content: str,
    content_type: str,
) -> str:
    """
    Verifica se nuovo contenuto generato è coerente col profilo del PG.
    """
    return f"""Verifica la coerenza di questo contenuto con il profilo di {character.name}.

=== PROFILO DEL PERSONAGGIO ===
Nome: {character.name}
Razza: {character.race}
Classe: {character.character_class}
Backstory: {character.backstory}
Tratti di personalità: {character.personality_traits}
Motivazioni: {character.motivations}
Sogni: {character.dreams}
Paure: {character.fears}
Modi di dire: {', '.join(character.catchphrases) if character.catchphrases else 'Nessuno'}

=== CONTENUTO DA VERIFICARE ===
Tipo: {content_type}
Contenuto: {new_content}

=== ISTRUZIONI ===
Analizza se il contenuto è coerente col personaggio.
Cerca contraddizioni in:
- Personalità e modo di parlare
- Motivazioni e azioni
- Backstory e eventi
- Tono e stile

Rispondi con:
COERENTE: [se tutto è ok]

oppure

INCOERENZE_TROVATE:
- [descrizione incoerenza 1]
- [descrizione incoerenza 2]

Lingua: italiano.
"""
