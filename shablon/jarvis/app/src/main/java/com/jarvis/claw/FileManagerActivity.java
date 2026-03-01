package com.jarvis.claw;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.support.v7.widget.LinearLayoutManager;
import android.support.v7.widget.RecyclerView;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;

public class FileManagerActivity extends Activity {

    public static ArrayList<SharedFile> fileList = new ArrayList<>(); // Stub cache for demo

    private RecyclerView rvFiles;
    private ImageView ivBack;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_file_manager);

        ivBack = (ImageView) findViewById(R.id.iv_back);
        ivBack.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                finish();
            }
        });

        rvFiles = (RecyclerView) findViewById(R.id.rv_files);
        rvFiles.setLayoutManager(new LinearLayoutManager(this));
        rvFiles.setAdapter(new FileAdapter());
    }

    public static class SharedFile {
        public String filename;
        public String url;
        public String type;

        public SharedFile(String filename, String url, String type) {
            this.filename = filename;
            this.url = url;
            this.type = type;
        }
    }

    private class FileAdapter extends RecyclerView.Adapter<FileAdapter.FileViewHolder> {

        @Override
        public FileViewHolder onCreateViewHolder(ViewGroup parent, int viewType) {
            View view = LayoutInflater.from(FileManagerActivity.this).inflate(R.layout.item_file, parent, false);
            return new FileViewHolder(view);
        }

        @Override
        public void onBindViewHolder(FileViewHolder holder, int position) {
            final SharedFile file = fileList.get(position);
            holder.tvFileName.setText(file.filename);
            holder.tvFileType.setText(file.type.toUpperCase());

            if (file.type.contains("photo") || file.type.contains("image")) {
                holder.ivFileIcon.setImageResource(android.R.drawable.ic_menu_gallery);
            } else if (file.type.contains("video")) {
                holder.ivFileIcon.setImageResource(android.R.drawable.ic_media_play);
            } else {
                holder.ivFileIcon.setImageResource(R.drawable.ic_attach);
            }

            holder.itemView.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    Intent i = new Intent(Intent.ACTION_VIEW);
                    i.setData(Uri.parse(file.url));
                    try {
                        startActivity(i);
                    } catch (Exception e) {
                        Toast.makeText(FileManagerActivity.this, "No app found to open this.", Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        @Override
        public int getItemCount() {
            return fileList.size();
        }

        class FileViewHolder extends RecyclerView.ViewHolder {
            ImageView ivFileIcon;
            TextView tvFileName;
            TextView tvFileType;
            ImageView ivDownload;

            FileViewHolder(View itemView) {
                super(itemView);
                ivFileIcon = (ImageView) itemView.findViewById(R.id.iv_file_icon);
                tvFileName = (TextView) itemView.findViewById(R.id.tv_file_name);
                tvFileType = (TextView) itemView.findViewById(R.id.tv_file_type);
                ivDownload = (ImageView) itemView.findViewById(R.id.iv_download);
            }
        }
    }
}
