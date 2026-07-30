'use client';

import React from 'react';
import { useSilencerBattle } from '../hooks/useSilencerBattle';
import SongbeastBattleAvatar from './battle/SongbeastBattleAvatar';
import BattleExplorationView from './battle/BattleExplorationView';
import BattleIntroTransition from './battle/BattleIntroTransition';
import ParchmentOverlay from './battle/ParchmentOverlay';
import VerseParchment from './battle/VerseParchment';
import ResponseChoices from './battle/ResponseChoices';
import FeedbackBanner from './battle/FeedbackBanner';
import TemptationLine from './battle/TemptationLine';
import ChosenResponseLine from './battle/ChosenResponseLine';
import DebriefContinueButton from './battle/DebriefContinueButton';
import SongbeastDebriefDialogue from './battle/SongbeastDebriefDialogue';

export default function SilencerBattleScene() {
  const {
    phase,
    verseError,
    verseReference,
    explorationPlayerPosition,
    explorationPlayerFacing,
    startExplorationMove,
    stopExplorationMove,
    showRestorePrompt,
    confirmRestore,
    challenge,
    answers,
    wrongBlanks,
    isReviewingMistake,
    setAnswer,
    submitAnswer,
    responses,
    responsesLoading,
    selectResponse,
    chosenMessage,
    gearPieces,
    restorePercent,
    temptationLine,
    showTemptationLine,
    showChosenLine,
    showRestoredBanner,
    isFinalRound,
    silencerTurnRequestId,
    battleTurnRequestId,
    avatarStartsRestored,
    thoughtBubbleText,
    thoughtBubbleVisible,
    thoughtBubbleBeat,
    wrongAnswerLine,
    showWrongAnswerLine,
    handleGearRemoved,
    handleGearLanded,
    handleReSilenceEffectStart,
    handleSilencerTurnComplete,
    handleFinalRestorationComplete,
    roundNumber,
    totalRounds,
    beginDialogue,
    debriefDisplay,
    debriefActiveSpeaker,
    advanceDialogue,
    acceptCucumberGift,
    chooseDialogueResponse,
  } = useSilencerBattle();

  // Mirrors exactly which phases render a ParchmentOverlay below, so the
  // restore bar (rendered over the Songbeast itself) never floats on top of
  // it - the two are visually incompatible (the bar reads as battle-field
  // UI, the parchment as a distinct "screen" laid over the whole scene).
  // EXPLORING/INTRO aren't in this list - EXPLORING doesn't render
  // SongbeastBattleAvatar (and therefore no restore bar) at all yet, and
  // INTRO has no parchment card of its own anymore (see BattleIntroTransition).
  const isParchmentActive =
    phase === 'LOADING' ||
    (phase === 'CHALLENGE' && !!challenge) ||
    phase === 'CORRECT' ||
    phase === 'INCORRECT' ||
    phase === 'CHOICE' ||
    (phase === 'RESTORED' && showRestoredBanner) ||
    phase === 'DEBRIEF_PROMPT' ||
    phase === 'DIALOGUE';

  return (
    <div className="flex-1 flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-center border-b-2 border-slate-700 pb-3 mb-4">
          <span className="text-purple-400 font-black tracking-widest uppercase text-xs">The Silencer&apos;s Battle</span>
          <span className="bg-red-950 text-red-400 px-2.5 py-1 text-xs font-bold rounded-lg border border-red-800 animate-pulse">
            COMBAT ACTIVE
          </span>
        </div>

        <div className="flex justify-end mb-3">
          <span className="text-[10px] font-black uppercase text-slate-400 whitespace-nowrap">
            Round {roundNumber + 1}/{totalRounds}
          </span>
        </div>

        {verseError && <p className="text-[10px] text-amber-400 text-center mb-2">{verseError}</p>}

        {phase === 'EXPLORING' && (
          <div className="relative">
            <BattleExplorationView
              playerPosition={explorationPlayerPosition}
              playerFacing={explorationPlayerFacing}
              onStartMove={startExplorationMove}
              onStopMove={stopExplorationMove}
              showRestorePrompt={showRestorePrompt}
              onConfirmRestore={confirmRestore}
            />
          </div>
        )}

        {phase !== 'EXPLORING' && (
          <BattleIntroTransition>
            <div className="relative">
              <SongbeastBattleAvatar
                gearPieces={gearPieces}
                silencerTurnRequestId={silencerTurnRequestId}
                onSilencerTurnComplete={handleSilencerTurnComplete}
                battleTurnRequestId={battleTurnRequestId}
                onGearRemoved={handleGearRemoved}
                onGearLanded={handleGearLanded}
                onReSilenceEffectStart={handleReSilenceEffectStart}
                onFinalRestorationComplete={handleFinalRestorationComplete}
                isFinalTurn={isFinalRound}
                startRestored={avatarStartsRestored}
                restorePercent={restorePercent}
                restoreBarVisible={!isParchmentActive}
                thoughtBubbleText={thoughtBubbleText}
                thoughtBubbleVisible={thoughtBubbleVisible}
                thoughtBubbleBeat={thoughtBubbleBeat}
              />

              {phase === 'LOADING' && (
                <ParchmentOverlay>
                  <div className="bg-amber-100 border-4 border-black p-6 rounded-2xl text-black shadow-[4px_4px_0px_#000] text-center">
                    <p className="font-black text-sm uppercase animate-pulse">Retrieving the verse...</p>
                  </div>
                </ParchmentOverlay>
              )}

              {phase === 'CHALLENGE' && challenge && (
                <ParchmentOverlay>
                  <VerseParchment
                    verseReference={verseReference}
                    challenge={challenge}
                    answers={answers}
                    wrongBlanks={wrongBlanks}
                    disabled={isReviewingMistake}
                    onAnswerChange={setAnswer}
                    onSubmit={submitAnswer}
                  />
                </ParchmentOverlay>
              )}

              {phase === 'CORRECT' && (
                <ParchmentOverlay>
                  <FeedbackBanner text="Good! ⭐" />
                </ParchmentOverlay>
              )}

              {phase === 'INCORRECT' && (
                <ParchmentOverlay>
                  <FeedbackBanner text="Good Try" />
                </ParchmentOverlay>
              )}

              {phase === 'CHOICE' && (
                <ParchmentOverlay>
                  <ResponseChoices options={responses} loading={responsesLoading} onSelect={selectResponse} />
                </ParchmentOverlay>
              )}

              {showTemptationLine && <TemptationLine message={temptationLine} />}

              {showWrongAnswerLine && <TemptationLine message={wrongAnswerLine ?? ''} />}

              {showChosenLine && chosenMessage && <ChosenResponseLine message={chosenMessage} />}

              {phase === 'RESTORED' && showRestoredBanner && (
                <ParchmentOverlay>
                  <FeedbackBanner text="Restored! ⭐" />
                </ParchmentOverlay>
              )}

              {phase === 'DEBRIEF_PROMPT' && <DebriefContinueButton onContinue={beginDialogue} />}

              {phase === 'DIALOGUE' && (
                <SongbeastDebriefDialogue
                  display={debriefDisplay}
                  activeSpeaker={debriefActiveSpeaker}
                  onAdvance={advanceDialogue}
                  onAcceptGift={acceptCucumberGift}
                  onChoose={chooseDialogueResponse}
                />
              )}
            </div>
          </BattleIntroTransition>
        )}
      </div>
    </div>
  );
}
