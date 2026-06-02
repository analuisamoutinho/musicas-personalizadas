import { collectPhotos } from "./collect-photos";
import { selectStyle } from "./select-style";
import { confirmOrder } from "./confirm-order";
import { generatePayment } from "./generate-payment";
import { enqueueGeneration } from "./enqueue-generation";
import { deliverImage } from "./deliver-image";
import { handleRevision } from "./handle-revision";
import { handleApproval } from "./handle-approval";
import { getGreetingContext } from "./get-greeting-context";
import { collectOutfit } from "./collect-outfit";
import { captureConsent } from "./capture-consent";
import { collectMusicaBriefing } from "./collect-musica-briefing";

export { collectPhotos, selectStyle, confirmOrder, generatePayment, enqueueGeneration, deliverImage, handleRevision, handleApproval, getGreetingContext, collectOutfit, captureConsent, collectMusicaBriefing };

/** All tools bundled for agent configuration. */
export const allTools = {
  collectPhotos,
  selectStyle,
  confirmOrder,
  generatePayment,
  enqueueGeneration,
  deliverImage,
  handleRevision,
  handleApproval,
  getGreetingContext,
  collectOutfit,
  captureConsent,
  collectMusicaBriefing,
};
