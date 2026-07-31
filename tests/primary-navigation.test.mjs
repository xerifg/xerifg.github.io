import assert from "node:assert/strict";
import * as libraryUiModel from "../static/library-ui-model.mjs";

const navigatePrimaryView = libraryUiModel.navigatePrimaryView;
assert.equal(
  typeof navigatePrimaryView,
  "function",
  "primary navigation should expose a state transition that can reset view-specific filters"
);

if (typeof navigatePrimaryView === "function") {
  const tagReturnContext = {
    selectedTag: "AI",
    query: "vision",
    sort: "recent"
  };
  const fromSettings = {
    view: "settings",
    selectedTag: "AI",
    tagReturnContext,
    modal: "stale-modal",
    modalContext: { stale: true },
    openCreateMenu: "document-actions"
  };

  const libraryState = navigatePrimaryView(fromSettings, "library");
  assert.equal(libraryState.view, "library");
  assert.equal(
    libraryState.selectedTag,
    "",
    "explicitly opening Notes should show the complete notebook tree instead of retaining a hidden tag filter"
  );
  assert.equal(
    libraryState.tagReturnContext,
    tagReturnContext,
    "opening Notes should not discard the return context of a document opened from a tag"
  );
  assert.equal(libraryState.modal, null);
  assert.equal(libraryState.modalContext, null);
  assert.equal(libraryState.openCreateMenu, null);

  const tagsState = navigatePrimaryView(fromSettings, "tags");
  assert.equal(tagsState.selectedTag, "AI", "other primary destinations should keep their existing tag selection");
}
