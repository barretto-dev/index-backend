const pointCloudService = require("../services/pointCloudService")

async function generationStart(req, res){

   try {
    const {wsUrl, wsPort} = req.body

    const result = pointCloudService.run3DReconDeep(wsUrl, wsPort)

    if (!result.success) 
      return res.status(500).json({message: "Geração de pointcloud encerrado com erro"});

    return res.status(200).json({message: "Geração de pointCloud iniciado com sucesso"});
   } catch (error) {
     console.error("Erro ao iniciar 3d recon deep:", error);

     return res.status(500).json({
      message: "Error ao iniciar geração de pointcloud",
      error: error.message,
    });
   }


}

async function generationStop(req, res){
   try {
    const result = pointCloudService.stop3DReconDeep()

     if (!result.success) 
      return res.status(500).json({message: "Geração de pointcloud encerrado com erro"});
     
     return res.status(200).json({message: "Geração de pointCloud encerrado com sucesso"});
   } catch (error) {
     console.error("Erro ao encerrar 3d recon deep:", error);

     return res.status(500).json({
      message: "Error ao encerrar geração de pointcloud",
      error: error.message,
    });
   }
}

module.exports = {
  generationStart,
  generationStop,
};