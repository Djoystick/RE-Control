with open(r"H:\Work\RE_Control\src\renderer\src\components\OverlayApp.tsx", "r", encoding="utf-8") as f:
    text = f.read()

# Scale Voting Panel
text = text.replace(
    '<div className="absolute bottom-12 right-12 flex flex-col gap-4 items-end">',
    '<div className="absolute bottom-12 right-12 flex flex-col gap-4 items-end" style={{ transform: "scale(0.75)", transformOrigin: "bottom right" }}>'
)

# Scale Intervention Banner
text = text.replace(
    '<motion.div\n            initial={{ y: -50, opacity: 0 }}\n            animate={{ y: 0, opacity: 1 }}\n            exit={{ y: -50, opacity: 0 }}\n            className="absolute top-12 left-1/2 -translate-x-1/2',
    '<motion.div\n            initial={{ y: -50, opacity: 0, scale: 0.75 }}\n            animate={{ y: 0, opacity: 1, scale: 0.75 }}\n            exit={{ y: -50, opacity: 0, scale: 0.75 }}\n            style={{ transformOrigin: "top center" }}\n            className="absolute top-12 left-1/2 -translate-x-1/2'
)

# Scale Narrator Banner
text = text.replace(
    '<motion.div\n              initial={{ y: -50, opacity: 0 }}\n              animate={{ y: 0, opacity: 1 }}\n              exit={{ y: -50, opacity: 0 }}\n              className={`absolute top-24 left-1/2 -translate-x-1/2',
    '<motion.div\n              initial={{ y: -50, opacity: 0, scale: 0.75 }}\n              animate={{ y: 0, opacity: 1, scale: 0.75 }}\n              exit={{ y: -50, opacity: 0, scale: 0.75 }}\n              style={{ transformOrigin: "top center" }}\n              className={`absolute top-24 left-1/2 -translate-x-1/2'
)

with open(r"H:\Work\RE_Control\src\renderer\src\components\OverlayApp.tsx", "w", encoding="utf-8") as f:
    f.write(text)
