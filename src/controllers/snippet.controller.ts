import { Request, Response } from "express";
import {
  ADD_SNIPPET,
  FETCH_ALL_SNIPPETS,
  SHARE_SNIPPET_PERSONALLY,
  UPDATE_SNIPPET_SHARE_STATUS,
} from "../services/snippet.service";
import mongoose from "mongoose";
import logger from "../utils/logger";
import crypto from "crypto";
import { encrypt } from "../utils/encrypt";
import { emailService } from "../services/mail.service";
import { send_snippet } from "../utils/mailFormats/send_snippet";

export async function addSnippet(req: Request, res: Response) {
  const BODY = req.body;
  let data;

  logger.info(`REQ : add a snippet in a category with data => ${BODY}`);
  try {
    data = await ADD_SNIPPET(BODY);
    logger.info("RES : a snippet has been added successfully");
    return res
      .status(201)
      .json({ message: "Snippet added successfully", data: data });
  } catch (error) {
    logger.info(`RES : an error occured in adding an snippet => ${error}`);
    return res.status(500).json({
      message: "Error while adding snippet",
      error: error,
    });
  }
}

export async function getSnippets(req: Request, res: Response) {
  let data;

  try {
    const cat_id = req.query.cat_id; // user id

    if (cat_id && typeof cat_id == "string") {
      const objectId = new mongoose.Types.ObjectId(cat_id);
      logger.info(
        `REQ : Fetch all snippets for a particular category => ${objectId}`
      );
      data = await FETCH_ALL_SNIPPETS(objectId);
    } else {
      logger.error("cat_id is required or is in the wrong format");
      return res.status(500).json({
        message: "cat_id is required or is in the wrong format",
      });
    }

    logger.info(`RESP : Snippets fetched => ${data}`);
    return res.status(200).json({
      message: "Snippets fetched successfully",
      data: data,
    });
  } catch (error) {
    logger.error(`Error in fetching Snippets => ${error}`);
    return res.status(500).json({
      message: "Error in fetching Snippets",
      error: error,
    });
  }
}

export async function shareSnippet(req: Request, res: Response) {
  try {
    const { share, email, snippetid, user_name } = req.body;
    logger.info(`REQ : Share snippet => ${snippetid}`);

    const id = encodeURIComponent(encrypt(snippetid));

    logger.info(`encrypted mongoDB id => ${id}`);

    if (share) {
      //update the db, that this particular snippet is sharable
      const snippet = await UPDATE_SNIPPET_SHARE_STATUS(snippetid);
      if (snippet) {
        const url = `https://snippsavvy.com/collab?snippet=${id}?sharing=true`;
        logger.info(`snippet sharing url generated => ${url}`);
        return res.status(200).json({ url: url });
      }
    } else {
      if (!email) {
        return res.status(500).json({ msg: "BAD REQUEST" });
      }
      // write logic for sending link in a mail
      const newemail = encodeURIComponent(encrypt(email));
      const snippet = SHARE_SNIPPET_PERSONALLY(snippetid, email);
      const url = `https://snippsavvy.com/collab?snippet=${id}?email=${newemail}`;
      logger.info(`snippet personal sharing url generated => ${url}`);
      const content = {
        user_name: user_name,
        email: email,
        url: url,
      };

      //send mail

      emailService(
        email,
        `${user_name} has sent you a snippet ⭐`,
        content,
        send_snippet
      )
        .then(() => logger.info(`Email sent successfully to ${email}`))
        .catch((error) => logger.error("Error in sending email:", error));
    }

    return res.status(200).json({ msg: "Snippet shared successfully" });
  } catch (error) {
    logger.error(`Error in sharing snippet => ${error}`);
    return res
      .status(500)
      .json({ msg: "Internal Server Error in sharing snippet" });
  }
}
