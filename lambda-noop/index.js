exports.handler = async (event) => {
    console.log("SFN Wait Hook Triggered", event);
    return { status: "waiting" };
};
